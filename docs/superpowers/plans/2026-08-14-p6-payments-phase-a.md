# P6 수납 처리 Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/staff/payment`에 수납 원장(`payments`)과 수동 수납 처리(수납/원금/분할/취소)·미납 계산·자동이체 세대 표시를 구현한다.

**Architecture:** 기존 부과(billing) 슬라이스(`0012_p5_billing.sql`, `hooks/reactquery/billing`)를 그대로 미러링한다. 신규 `payments` 테이블 + RLS + security-definer RPC(`record_payment`/`cancel_payment`/`list_payment_rows`/`list_unit_payments`)로 무결성·미납 계산을 서버측에 두고, React Query 훅과 `/staff/payment` 화면(민원 `receipts` 페이지 패턴 재사용)을 붙인다.

**Tech Stack:** Next.js(app router, `app/(staff)`), Supabase(Postgres RPC + RLS), React Query(`hooks/reactquery/*`), vitest, Tailwind + `@/components/common`, `exceljs`(이번 범위 밖).

## Global Constraints

- 마이그레이션 파일명 = `supabase/migrations/0015_p6_payments.sql` (0013 번호 중복 존재 → 0015 사용). 라이브 적용은 사용자 PC 수동.
- 금액 컬럼은 **`integer`** (billing 관례; 스펙의 numeric(12,0) → integer로 정렬). 원(₩) 정수.
- `period`는 **`date` 타입, 월초 1일**(`period = date_trunc('month', period)::date`). API/훅은 `"YYYY-MM-01"` 문자열로 주고받는다(billing과 동일).
- 조직 격리: RLS는 `unit_id ∈ my_org_ids() 건물`, 쓰기는 추가로 `current_user_has_module('payment')`. USING+WITH CHECK 양쪽. RPC는 security definer + 내부 재검증.
- 모듈 키 = `payment` (이미 `lib/auth/permissions.ts:14` 등록). 화면 게이트 `hasModule(me, 'payment')`.
- 취소 = 소프트(`status='canceled'`), 하드삭제 금지. 미납 = `charged − active 수납합`, `charged`(=`billing_confirmations.total_amount`) 없으면 null(미확정).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- 무관한 변경 보존, 명시 요청 없이는 최종 통합 커밋만(각 태스크 커밋은 진행).

---

### Task 1: 마이그레이션 `0015_p6_payments.sql`

`payments` 테이블 + RLS + RPC 4종. SQL은 자동 테스트 프레임워크가 없으므로 **셀프 체크리스트 + 이후 훅 태스크의 계약 테스트**로 검증한다(라이브 적용은 사용자).

**Files:**
- Create: `supabase/migrations/0015_p6_payments.sql`

**Interfaces:**
- Consumes(기존): `organizations(id)`, `units(id, building_id, unit_no, dong, deleted_at)`, `buildings(id, org_id)`, `occupancies(id, unit_id, tenant_name, status, deleted_at, created_at)`, `profiles(user_id)`, `billing_confirmations(unit_id, period, total_amount)`, `unit_accounts`(kind='mgmt', `cms_member_no`), `bill_issues`(unit_id, period, due_date, issued_at), 헬퍼 `current_user_org()`, `current_user_has_module(text)`, `my_org_ids()`, `set_updated_at()`, `audit_log`.
- Produces(후속 태스크가 의존하는 RPC 계약):
  - `record_payment(p_unit_id bigint, p_period date, p_amount int, p_method text, p_kind text, p_memo text, p_paid_at date) returns jsonb` → `{ ok, payment_id, charged, paid, unpaid }`
  - `cancel_payment(p_payment_id bigint) returns jsonb` → `{ ok, unit_id, period, charged, paid, unpaid }`
  - `list_payment_rows(p_building_id bigint, p_period date) returns table(unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text, is_vacant boolean, is_auto_debit boolean, due_date date, charged int, paid int)`
  - `list_unit_payments(p_unit_id bigint, p_period date) returns table(id bigint, amount int, method text, kind text, memo text, paid_at date, status text, created_at timestamptz)`

- [ ] **Step 1: 인접 컬럼명 검증**

Read로 확인하고 SQL의 컬럼 참조를 실제와 일치시킨다(불일치 시 조정):
- `supabase/migrations/0006_p3b_tenants.sql` — `unit_accounts`의 컬럼(`unit_id`, `kind` 값에 `'mgmt'` 존재?, `cms_member_no`).
- `supabase/migrations/0013_p5_bill_publish.sql` — `bill_issues`의 `period`(date?), `due_date`, `issued_at`.
- `supabase/migrations/0012_p5_billing.sql` — RLS·RPC 가드·grant 스타일(본 파일이 미러 대상).

- [ ] **Step 2: 마이그레이션 작성**

```sql
-- 0015_p6_payments.sql
-- P6: 수납 처리 Phase A (payments 원장 + 수동 수납/원금/분할/취소)
-- 의존: P0(profiles·audit_log·set_updated_at), P1a(units), P2a(current_user_org·current_user_has_module·my_org_ids),
--       P3b(occupancies·unit_accounts), P5(billing_confirmations), P5 bill_publish(bill_issues)
-- 모듈 게이트: payment

-- ===== 테이블 =====
create table payments (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,
  amount integer not null check (amount > 0),
  method text not null default 'transfer'
    check (method in ('cash','transfer','auto_debit','giro','card','other')),
  kind text not null check (kind in ('full','principal','partial')),
  memo text,
  paid_at date not null default current_date,
  status text not null default 'active' check (status in ('active','canceled')),
  canceled_at timestamptz,
  canceled_by uuid references profiles(user_id) on delete set null,
  source text not null default 'manual' check (source in ('manual','bank_excel','cms')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(user_id) on delete set null
);
create index on payments (unit_id, period);
create index on payments (org_id, period);

create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();

-- ===== RLS: SELECT org 개방 / 쓰기 payment 모듈 =====
alter table payments enable row level security;
create policy pay_select on payments for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy pay_write on payments for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('payment'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('payment'));

-- ===== 수납 기록 =====
create or replace function record_payment(
  p_unit_id bigint, p_period date, p_amount int,
  p_method text, p_kind text, p_memo text, p_paid_at date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_occ bigint; v_id bigint; v_charged int; v_paid int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if not exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p_unit_id and b.org_id=v_org and u.deleted_at is null) then
    raise exception 'unit not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'amount must be positive'; end if;
  if p_method not in ('cash','transfer','auto_debit','giro','card','other') then raise exception 'invalid method'; end if;
  if p_kind not in ('full','principal','partial') then raise exception 'invalid kind'; end if;

  select o.id into v_occ from occupancies o
   where o.unit_id=p_unit_id and o.deleted_at is null
   order by o.created_at desc, o.id desc limit 1;

  insert into payments(org_id, unit_id, period, occupancy_id, amount, method, kind, memo, paid_at, source, created_by)
    values (v_org, p_unit_id, p_period, v_occ, p_amount, p_method, p_kind, nullif(p_memo,''),
            coalesce(p_paid_at, current_date), 'manual', auth.uid())
    returning id into v_id;

  select bc.total_amount into v_charged from billing_confirmations bc
    where bc.unit_id=p_unit_id and bc.period=p_period;
  select coalesce(sum(amount),0)::int into v_paid from payments
    where unit_id=p_unit_id and period=p_period and status='active';

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_RECORD', 'payments', v_id::text,
      jsonb_build_object('unit_id',p_unit_id,'period',p_period,'amount',p_amount,'kind',p_kind,'method',p_method));

  return jsonb_build_object('ok',true,'payment_id',v_id,'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $$;
revoke execute on function record_payment(bigint, date, int, text, text, text, date) from public, anon;
grant execute on function record_payment(bigint, date, int, text, text, text, date) to authenticated;

-- ===== 수납 취소(소프트) =====
create or replace function cancel_payment(p_payment_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_unit bigint; v_period date; v_charged int; v_paid int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;

  update payments p set status='canceled', canceled_at=now(), canceled_by=auth.uid()
   where p.id=p_payment_id and p.status='active' and p.org_id=v_org
     and exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p.unit_id and b.org_id=v_org)
   returning p.unit_id, p.period into v_unit, v_period;
  if v_unit is null then raise exception 'payment not found or already canceled'; end if;

  select bc.total_amount into v_charged from billing_confirmations bc
    where bc.unit_id=v_unit and bc.period=v_period;
  select coalesce(sum(amount),0)::int into v_paid from payments
    where unit_id=v_unit and period=v_period and status='active';

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_CANCEL', 'payments', p_payment_id::text,
      jsonb_build_object('unit_id',v_unit,'period',v_period));

  return jsonb_build_object('ok',true,'unit_id',v_unit,'period',v_period,'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $$;
revoke execute on function cancel_payment(bigint) from public, anon;
grant execute on function cancel_payment(bigint) to authenticated;

-- ===== 세대별 수납 현황(건물·기간) =====
create or replace function list_payment_rows(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text,
  is_vacant boolean, is_auto_debit boolean, due_date date, charged int, paid int
) language sql stable security definer set search_path = public as $$
  with u as (
    select id, unit_no, dong from units
    where building_id=p_building_id and deleted_at is null
      and building_id in (select id from buildings where org_id=current_user_org())
  ),
  occ as (
    select distinct on (o.unit_id) o.unit_id, o.id as occupancy_id, o.tenant_name, o.status
    from occupancies o join u on u.id=o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  ),
  pay as (
    select p.unit_id, coalesce(sum(p.amount),0)::int as paid
    from payments p join u on u.id=p.unit_id
    where p.period=p_period and p.status='active'
    group by p.unit_id
  )
  select
    u.id, u.unit_no, u.dong, occ.occupancy_id, occ.tenant_name,
    coalesce(occ.status='vacant', true) as is_vacant,
    (ua.cms_member_no is not null) as is_auto_debit,
    bi.due_date,
    bc.total_amount as charged,
    coalesce(pay.paid, 0) as paid
  from u
  left join occ on occ.unit_id=u.id
  left join pay on pay.unit_id=u.id
  left join billing_confirmations bc on bc.unit_id=u.id and bc.period=p_period
  left join lateral (
    select cms_member_no from unit_accounts a
    where a.unit_id=u.id and a.kind='mgmt' order by a.id desc limit 1
  ) ua on true
  left join lateral (
    select due_date from bill_issues x
    where x.unit_id=u.id and x.period=p_period
    order by x.issued_at desc nulls last, x.id desc limit 1
  ) bi on true
  order by u.unit_no
$$;
revoke execute on function list_payment_rows(bigint, date) from public, anon;
grant execute on function list_payment_rows(bigint, date) to authenticated;

-- ===== 세대 수납 이력(취소용) =====
create or replace function list_unit_payments(p_unit_id bigint, p_period date)
returns table(id bigint, amount int, method text, kind text, memo text,
              paid_at date, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.amount, p.method, p.kind, p.memo, p.paid_at, p.status, p.created_at
  from payments p
  join units u on u.id=p.unit_id
  join buildings b on b.id=u.building_id and b.org_id=current_user_org()
  where p.unit_id=p_unit_id and p.period=p_period
  order by p.created_at desc, p.id desc
$$;
revoke execute on function list_unit_payments(bigint, date) from public, anon;
grant execute on function list_unit_payments(bigint, date) to authenticated;
```

- [ ] **Step 3: 셀프 체크리스트 검증**

다음을 눈으로 확인:
- 4개 RPC 모두 `revoke ... from public, anon` + `grant ... to authenticated` 있음.
- 4개 RPC 모두 `current_user_org()` null 체크. 쓰기 RPC 2종은 `current_user_has_module('payment')` 체크.
- `period` first-of-month 체크(record_payment). 금액 `> 0` 체크.
- 컬럼 참조가 Step 1 검증 결과와 일치.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0015_p6_payments.sql
git commit -m "feat(payment): payments 원장 테이블·RLS·RPC 마이그레이션(0015)"
```

---

### Task 2: 미납/상태 순수 로직 `lib/payments/status.ts`

미납·상태 도출을 DB 없이 단위 테스트 가능한 순수 함수로 분리(TDD).

**Files:**
- Create: `lib/payments/status.ts`
- Test: `lib/payments/status.test.ts`

**Interfaces:**
- Produces:
  - `type PayStatus = 'unbilled'|'unpaid'|'partial'|'paid'|'over'`
  - `computeUnpaid(charged: number|null, paid: number): number|null`
  - `derivePayStatus(charged: number|null, paid: number): PayStatus`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/payments/status.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeUnpaid, derivePayStatus } from "./status";

describe("computeUnpaid", () => {
  it("charged가 null이면 null", () => expect(computeUnpaid(null, 0)).toBeNull());
  it("charged-paid", () => expect(computeUnpaid(10000, 4000)).toBe(6000));
  it("과다수납은 음수", () => expect(computeUnpaid(10000, 12000)).toBe(-2000));
});

describe("derivePayStatus", () => {
  it("미확정(charged null) → unbilled", () => expect(derivePayStatus(null, 0)).toBe("unbilled"));
  it("부과0·수납0 → paid(완납)", () => expect(derivePayStatus(0, 0)).toBe("paid"));
  it("부과0·수납>0 → over", () => expect(derivePayStatus(0, 500)).toBe("over"));
  it("수납0 → unpaid", () => expect(derivePayStatus(10000, 0)).toBe("unpaid"));
  it("부분 → partial", () => expect(derivePayStatus(10000, 4000)).toBe("partial"));
  it("완납 → paid", () => expect(derivePayStatus(10000, 10000)).toBe("paid"));
  it("과다 → over", () => expect(derivePayStatus(10000, 12000)).toBe("over"));
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/payments/status.test.ts`
Expected: FAIL ("Cannot find module './status'" 또는 함수 미정의)

- [ ] **Step 3: 구현**

`lib/payments/status.ts`:
```ts
export type PayStatus = "unbilled" | "unpaid" | "partial" | "paid" | "over";

export function computeUnpaid(charged: number | null, paid: number): number | null {
  return charged == null ? null : charged - paid;
}

export function derivePayStatus(charged: number | null, paid: number): PayStatus {
  if (charged == null) return "unbilled";
  if (charged <= 0) return paid > 0 ? "over" : "paid";
  if (paid <= 0) return "unpaid";
  if (paid < charged) return "partial";
  if (paid === charged) return "paid";
  return "over";
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/payments/status.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/payments/status.ts lib/payments/status.test.ts
git commit -m "feat(payment): 미납·수납상태 순수 도출 로직"
```

---

### Task 3: React Query 훅 `hooks/reactquery/payments/*`

`billing` 훅 폴더 구조·스타일을 미러링. apis 매핑은 TDD.

**Files:**
- Create: `hooks/reactquery/payments/apis.ts`
- Create: `hooks/reactquery/payments/keys.ts`
- Create: `hooks/reactquery/payments/queries.ts`
- Create: `hooks/reactquery/payments/mutations.ts`
- Create: `hooks/reactquery/payments/index.ts`
- Test: `hooks/reactquery/payments/apis.test.ts`

**Interfaces:**
- Consumes: Task 1 RPC 4종, Task 2 `PayStatus`/`computeUnpaid`/`derivePayStatus`, `@/lib/supabase/client` `createClient`.
- Produces:
  - types: `PaymentMethod`, `PaymentKind`, `PaymentRow`, `RecordPaymentInput`, `PaymentBalance`, `UnitPayment`
  - apis: `listPaymentRows(buildingId, period)`, `recordPayment(input)`, `cancelPayment(paymentId)`, `listUnitPayments(unitId, period)`
  - hooks: `usePaymentRows(buildingId, period)`, `useUnitPayments(unitId, period)`, `useRecordPayment()`, `useCancelPayment()`
  - keys: `paymentKeys.rows(buildingId, period)`, `paymentKeys.unit(unitId, period)`

- [ ] **Step 1: 실패하는 apis 테스트 작성**

`hooks/reactquery/payments/apis.test.ts` (billing 테스트가 없으면 `hooks/reactquery/*/apis.test.ts` 스타일 참고; `createClient`를 mock):
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { listPaymentRows, recordPayment, cancelPayment } from "./apis";

beforeEach(() => rpc.mockReset());

describe("listPaymentRows", () => {
  it("row를 camelCase + unpaid/payStatus로 매핑", async () => {
    rpc.mockResolvedValue({
      data: [{
        unit_id: 1, unit_no: "101", dong: "A", occupancy_id: 9, tenant_name: "김철수",
        is_vacant: false, is_auto_debit: true, due_date: "2026-08-25", charged: 10000, paid: 4000,
      }], error: null,
    });
    const rows = await listPaymentRows(1, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_payment_rows", { p_building_id: 1, p_period: "2026-08-01" });
    expect(rows[0]).toMatchObject({
      unitId: 1, unitNo: "101", tenantName: "김철수", isAutoDebit: true,
      charged: 10000, paid: 4000, unpaid: 6000, payStatus: "partial",
    });
  });
  it("charged null이면 unpaid null + unbilled", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 2, unit_no: "102", dong: null, occupancy_id: null, tenant_name: null,
      is_vacant: true, is_auto_debit: false, due_date: null, charged: null, paid: 0,
    }], error: null });
    const rows = await listPaymentRows(1, "2026-08-01");
    expect(rows[0].unpaid).toBeNull();
    expect(rows[0].payStatus).toBe("unbilled");
  });
  it("error는 throw", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listPaymentRows(1, "2026-08-01")).rejects.toThrow("boom");
  });
});

describe("recordPayment", () => {
  it("입력을 snake_case p_* 인자로 전달하고 balance 반환", async () => {
    rpc.mockResolvedValue({ data: { ok: true, payment_id: 5, charged: 10000, paid: 10000, unpaid: 0 }, error: null });
    const res = await recordPayment({ unitId: 1, period: "2026-08-01", amount: 6000, method: "transfer", kind: "partial", memo: "메모" });
    expect(rpc).toHaveBeenCalledWith("record_payment", {
      p_unit_id: 1, p_period: "2026-08-01", p_amount: 6000,
      p_method: "transfer", p_kind: "partial", p_memo: "메모", p_paid_at: null,
    });
    expect(res).toMatchObject({ charged: 10000, paid: 10000, unpaid: 0 });
  });
});

describe("cancelPayment", () => {
  it("payment_id 전달", async () => {
    rpc.mockResolvedValue({ data: { ok: true, unit_id: 1, period: "2026-08-01", charged: 10000, paid: 0, unpaid: 10000 }, error: null });
    await cancelPayment(5);
    expect(rpc).toHaveBeenCalledWith("cancel_payment", { p_payment_id: 5 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run hooks/reactquery/payments/apis.test.ts`
Expected: FAIL (모듈/함수 미정의)

- [ ] **Step 3: `apis.ts` 구현**

```ts
import { createClient } from "@/lib/supabase/client";
import { computeUnpaid, derivePayStatus, type PayStatus } from "@/lib/payments/status";

export type PaymentMethod = "cash" | "transfer" | "auto_debit" | "giro" | "card" | "other";
export type PaymentKind = "full" | "principal" | "partial";
export type { PayStatus };

export interface PaymentRow {
  unitId: number; unitNo: string; dong: string | null;
  occupancyId: number | null; tenantName: string | null; isVacant: boolean;
  isAutoDebit: boolean; dueDate: string | null;
  charged: number | null; paid: number; unpaid: number | null; payStatus: PayStatus;
}
export interface PaymentBalance { charged: number | null; paid: number; unpaid: number | null; }
export interface RecordPaymentInput {
  unitId: number; period: string; amount: number;
  method: PaymentMethod; kind: PaymentKind; memo?: string | null; paidAt?: string | null;
}
export interface UnitPayment {
  id: number; amount: number; method: PaymentMethod; kind: PaymentKind;
  memo: string | null; paidAt: string; status: "active" | "canceled"; createdAt: string;
}

type PaymentRowDb = {
  unit_id: number; unit_no: string; dong: string | null; occupancy_id: number | null;
  tenant_name: string | null; is_vacant: boolean; is_auto_debit: boolean;
  due_date: string | null; charged: number | null; paid: number;
};
type BalanceDb = { charged: number | null; paid: number; unpaid: number | null };
type UnitPaymentDb = {
  id: number; amount: number; method: PaymentMethod; kind: PaymentKind;
  memo: string | null; paid_at: string; status: "active" | "canceled"; created_at: string;
};

export async function listPaymentRows(buildingId: number, period: string): Promise<PaymentRow[]> {
  const { data, error } = await createClient().rpc("list_payment_rows", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PaymentRowDb[]).map((r) => ({
    unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong,
    occupancyId: r.occupancy_id, tenantName: r.tenant_name, isVacant: r.is_vacant,
    isAutoDebit: r.is_auto_debit, dueDate: r.due_date,
    charged: r.charged, paid: r.paid,
    unpaid: computeUnpaid(r.charged, r.paid), payStatus: derivePayStatus(r.charged, r.paid),
  }));
}

export async function recordPayment(input: RecordPaymentInput): Promise<PaymentBalance> {
  const { data, error } = await createClient().rpc("record_payment", {
    p_unit_id: input.unitId, p_period: input.period, p_amount: input.amount,
    p_method: input.method, p_kind: input.kind,
    p_memo: input.memo ?? null, p_paid_at: input.paidAt ?? null,
  });
  if (error) throw new Error(error.message);
  const r = data as BalanceDb;
  return { charged: r.charged, paid: r.paid, unpaid: r.unpaid };
}

export async function cancelPayment(paymentId: number): Promise<PaymentBalance> {
  const { data, error } = await createClient().rpc("cancel_payment", { p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  const r = data as BalanceDb;
  return { charged: r.charged, paid: r.paid, unpaid: r.unpaid };
}

export async function listUnitPayments(unitId: number, period: string): Promise<UnitPayment[]> {
  const { data, error } = await createClient().rpc("list_unit_payments", { p_unit_id: unitId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as UnitPaymentDb[]).map((r) => ({
    id: r.id, amount: r.amount, method: r.method, kind: r.kind,
    memo: r.memo, paidAt: r.paid_at, status: r.status, createdAt: r.created_at,
  }));
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run hooks/reactquery/payments/apis.test.ts`
Expected: PASS

- [ ] **Step 5: keys/queries/mutations/index 작성**

`keys.ts`:
```ts
export const paymentKeys = {
  all: ["payments"] as const,
  rows: (buildingId: number, period: string) => ["payments", "rows", buildingId, period] as const,
  unit: (unitId: number, period: string) => ["payments", "unit", unitId, period] as const,
};
```
`queries.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { listPaymentRows, listUnitPayments } from "./apis";
import { paymentKeys } from "./keys";

export function usePaymentRows(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.rows(buildingId ?? 0, period),
    queryFn: () => listPaymentRows(buildingId as number, period),
    enabled: buildingId !== null && Boolean(period),
  });
}
export function useUnitPayments(unitId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.unit(unitId ?? 0, period),
    queryFn: () => listUnitPayments(unitId as number, period),
    enabled: unitId !== null && Boolean(period),
  });
}
```
`mutations.ts` (성공 시 관련 쿼리 무효화):
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelPayment, recordPayment, type RecordPaymentInput } from "./apis";
import { paymentKeys } from "./keys";

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => recordPayment(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.all }),
  });
}
export function useCancelPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: number) => cancelPayment(paymentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.all }),
  });
}
```
`index.ts`:
```ts
export * from "./apis";
export * from "./keys";
export * from "./queries";
export * from "./mutations";
```

- [ ] **Step 6: 타입체크 + 커밋**

Run: `npx vitest run hooks/reactquery/payments/apis.test.ts` (PASS 유지). `npm run lint` (payments 폴더 무경고).
```bash
git add hooks/reactquery/payments
git commit -m "feat(payment): 수납 React Query 훅(apis·queries·mutations)"
```

---

### Task 4: 상수 + 수납 테이블 컴포넌트

**Files:**
- Create: `app/(staff)/staff/payment/constants.ts`
- Create: `app/(staff)/staff/payment/components/PaymentTable.tsx`

**Interfaces:**
- Consumes: Task 3 `PaymentRow`, `PayStatus`, `PaymentMethod`, `PaymentKind`.
- Produces:
  - `constants.ts`: `PAY_STATUS_LABEL: Record<PayStatus,string>`, `PAY_STATUS_STYLE: Record<PayStatus,string>`, `METHOD_LABEL: Record<PaymentMethod,string>`, `METHOD_OPTIONS`, `KIND_LABEL: Record<PaymentKind,string>`.
  - `PaymentTable`: props `{ rows: PaymentRow[]; isLoading: boolean; onAction(row, action): void }` where `action = 'full'|'principal'|'partial'|'cancel'`.

- [ ] **Step 1: `constants.ts` 작성**

라벨/스타일 매핑. 값:
- `PAY_STATUS_LABEL` = { unbilled:"미확정", unpaid:"미납", partial:"부분납", paid:"완납", over:"과납" }
- `PAY_STATUS_STYLE`: 기존 `receipts/constants.ts`의 뱃지 클래스 톤(예: `COMPLAINT_STATUS_STYLE`)을 참고해 상태별 tailwind 클래스 지정(미납=red, 부분=amber, 완납=green, 과납=blue, 미확정=회색).
- `METHOD_LABEL` = { cash:"현금", transfer:"계좌이체", auto_debit:"자동이체", giro:"지로", card:"카드", other:"기타" }
- `METHOD_OPTIONS` = `METHOD_LABEL`을 `{value,label}[]`로.
- `KIND_LABEL` = { full:"수납", principal:"원금", partial:"분할" }

- [ ] **Step 2: `PaymentTable.tsx` 작성**

`app/(staff)/staff/receipts/components/ComplaintTable.tsx`의 구조(로딩 스켈레톤, 빈상태, `@/components/common` 사용)를 미러링. 컬럼: 호실(dong+unitNo) / 입주자(tenantName, 공실 표시) / 부과금액(charged, null이면 `-`) / 수납금액(paid) / 미납금액(unpaid, null이면 `-`) / 납기일(dueDate) / 상태(`PAY_STATUS_LABEL`+`PAY_STATUS_STYLE` 뱃지, isAutoDebit이면 "자동이체" 뱃지 병기) / 처리(행별 버튼 `수납`·`원금`·`분할`·`취소`). 금액은 `num` 클래스 + `toLocaleString()`. 버튼 클릭 시 `onAction(row, kind|'cancel')`. `payStatus==='paid'`면 수납/원금 버튼 비활성, `payStatus==='unbilled'`면 수납/원금/분할 비활성(부과 미확정).

- [ ] **Step 3: 타입체크 + 커밋**

Run: `npm run lint` (payment 폴더 무경고). 
```bash
git add "app/(staff)/staff/payment/constants.ts" "app/(staff)/staff/payment/components/PaymentTable.tsx"
git commit -m "feat(payment): 수납 상수·현황 테이블 컴포넌트"
```

---

### Task 5: 분할 입력 모달 + 세대 수납 이력/취소 모달

**Files:**
- Create: `app/(staff)/staff/payment/components/PaymentAmountModal.tsx`
- Create: `app/(staff)/staff/payment/components/PaymentHistoryModal.tsx`

**Interfaces:**
- Consumes: Task 3 `PaymentRow`, `UnitPayment`, `useUnitPayments`, `METHOD_OPTIONS`, `METHOD_LABEL`, `KIND_LABEL`, `PAY_STATUS_LABEL`.
- Produces:
  - `PaymentAmountModal`: props `{ open; row: PaymentRow; kind: PaymentKind; defaultAmount: number; isPending: boolean; onClose(); onSubmit({ amount, method, memo, paidAt }): void }`. 분할=금액 입력(기본=미납액), 수납/원금=금액 고정 표시(미납 전액)이되 방법/비고/수납일 입력. 방법 기본 `transfer`.
  - `PaymentHistoryModal`: props `{ open; unitId; period; isPending; onClose(); onCancel(paymentId): void }`. `useUnitPayments(unitId, period)`로 목록, active행에 `취소` 버튼(확인 후 `onCancel`), canceled행은 흐리게 + 상태 라벨.

- [ ] **Step 1: `PaymentAmountModal.tsx` 작성**

`receipts/components/ComplaintFormModal.tsx`의 모달 뼈대(오버레이·포커스·`@/components/common` `Button`/`Input`/`Select`)를 미러링. 금액 입력은 숫자, `amount>0` 검증(아니면 제출 비활성). 분할이면 `max`는 두지 않음(과납 허용, 상태로 표시). 제출 시 `onSubmit`.

- [ ] **Step 2: `PaymentHistoryModal.tsx` 작성**

동일 모달 뼈대. `useUnitPayments` 로딩/빈상태 처리. 각 active 행: 금액·방법(`METHOD_LABEL`)·유형(`KIND_LABEL`)·수납일·비고 + `취소` 버튼(`window.confirm` 또는 인라인 확인 후 `onCancel(id)`). canceled 행은 `opacity` 낮춰 이력 유지.

- [ ] **Step 3: 타입체크 + 커밋**

Run: `npm run lint`.
```bash
git add "app/(staff)/staff/payment/components/PaymentAmountModal.tsx" "app/(staff)/staff/payment/components/PaymentHistoryModal.tsx"
git commit -m "feat(payment): 분할 입력·수납 이력/취소 모달"
```

---

### Task 6: 페이지 조립 `app/(staff)/staff/payment/page.tsx` + 통합 테스트

**Files:**
- Create: `app/(staff)/staff/payment/page.tsx`
- Test: `app/(staff)/staff/payment/page.test.tsx`

**Interfaces:**
- Consumes: Task 3 훅 전체, Task 4 `PaymentTable`/상수, Task 5 모달 2종, `useMe`/`hasModule`, `useBuildings`, `@/components/common`, `sonner` toast.
- Produces: default export `PaymentProcessingPage`.

- [ ] **Step 1: `page.tsx` 작성**

`app/(staff)/staff/receipts/page.tsx` 구조를 미러링:
- 최상위 `PaymentProcessingPage`: `useMe()` → 로딩 `Spinner`, `!hasModule(me,'payment')`면 `EmptyState("수납 처리 권한이 없습니다")`, 아니면 `<PaymentProcessing orgId={me.orgId} />`.
- `PaymentProcessing`: 상태 `buildingId`(기본 첫 건물), `period`(기본 당월 `YYYY-MM-01`), `search`(이름·호실). `useBuildings()`, `usePaymentRows(buildingId, period)`.
- 기간 입력은 `<input type="month">` 값(`YYYY-MM`)을 `${value}-01`로 변환해 훅에 전달(management-fee 페이지의 기간 처리 방식 확인해 일치).
- 검색: `rows`를 tenantName/unitNo/dong 부분일치로 클라이언트 필터.
- 액션 처리: `PaymentTable`의 `onAction`:
  - `partial` → `PaymentAmountModal`(kind=partial, defaultAmount=unpaid≥0?unpaid:0) 열기.
  - `full`/`principal` → `PaymentAmountModal`(금액 고정=unpaid) 열기(방법/비고/수납일 확인). 제출 시 `useRecordPayment().mutateAsync({ unitId, period, amount, method, kind, memo, paidAt })`.
  - `cancel` → `PaymentHistoryModal` 열기 → `useCancelPayment().mutateAsync(id)`.
- 성공/실패 `toast.success/error`, 목록 자동 무효화(mutations onSuccess). 에러 상태 `refetch` 버튼.

- [ ] **Step 2: 통합 테스트 작성**

`app/(staff)/staff/payment/page.test.tsx` — `receipts/page.test.tsx` 스타일로 훅 mock. 최소 3 케이스:
```ts
// 1) 권한 없으면 EmptyState
// 2) rows 렌더: 호실·부과·미납·상태 뱃지 표시, 자동이체 뱃지
// 3) '수납' 클릭 → 모달 → 제출 시 useRecordPayment.mutateAsync가 {unitId,period,amount(=unpaid),kind:'full'}로 호출
```
`useMe`, `useBuildings`, `usePaymentRows`, `useRecordPayment`, `useCancelPayment`, `useUnitPayments`를 `vi.mock`. `mutateAsync` spy로 인자 검증.

- [ ] **Step 3: 실패→구현→통과**

Run: `npx vitest run "app/(staff)/staff/payment/page.test.tsx"`
Expected: 최종 PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(staff)/staff/payment/page.tsx" "app/(staff)/staff/payment/page.test.tsx"
git commit -m "feat(payment): 수납 처리 페이지 조립 + 통합 테스트"
```

---

### Task 7: 네비게이션 노출

**Files:**
- Modify: `components/shell/navItems.ts` (수납처리 항목 `built: false → true`)
- Test: `components/shell/navItems.test.ts`

**Interfaces:**
- Consumes: 없음. Produces: 없음(설정 변경).

- [ ] **Step 1: 테스트 먼저 갱신**

`navItems.test.ts`에 `/staff/payment` 항목이 `built: true`임을 단언하는 케이스 추가(기존 `/staff/receipts` 단언 패턴 미러):
```ts
expect(all.find((i) => i.href === "/staff/payment")).toMatchObject({ module: "payment", built: true });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run components/shell/navItems.test.ts`
Expected: FAIL (`built: false`)

- [ ] **Step 3: `navItems.ts` 수정**

`{ label: "수납처리", href: "/staff/payment", module: "payment", built: false, ... }` → `built: true`.

- [ ] **Step 4: 통과 + 전체 검증 + 커밋**

Run: `npx vitest run components/shell/navItems.test.ts` (PASS)
Run: `npm run lint` 및 `npx vitest run` (전체 그린; 사전 존재 실패는 무관 범위로 기록)
```bash
git add components/shell/navItems.ts components/shell/navItems.test.ts
git commit -m "feat(payment): 수납처리 네비게이션 노출(built)"
```

---

## Self-Review (작성자 체크 완료)

**Spec 커버리지**: 스펙 §3(테이블·RLS·RPC)=Task1 · §4(훅)=Task3 · §2 결정/미납로직=Task2 · §5(UI)=Task4·5·6 · navItems=Task7 · 테스트=각 태스크 + Task6 통합. 범위 밖(B·C·D·영수증·문자·다월연체)은 계획에서 제외 — 일치.

**플레이스홀더**: SQL·순수로직·apis·키 테스트는 완전 코드. UI(Task4·5·6)는 완전 코드 대신 **정확한 props 계약 + 미러 대상 파일 + 수용 기준**을 명시(레포 인스펙션 워커 기준, CLAUDE.md 위임 원칙). "TBD/적절히 처리" 류 없음.

**타입 일관성**: `PayStatus`는 `lib/payments/status.ts` 단일 정의, apis에서 재export. RPC 인자명(`p_*`)·반환키(`charged/paid/unpaid`)가 Task1↔Task3 일치. `onAction(row, 'full'|'principal'|'partial'|'cancel')`가 Task4↔Task6 일치. `RecordPaymentInput` 필드가 Task3↔Task6 일치.

**검증 유의**: SQL은 무단위테스트 — Task1 Step1 컬럼검증 + Task3 계약테스트로 대체, 라이브 적용은 사용자. `unit_accounts`/`bill_issues` 컬럼은 Task1 Step1에서 실검증 후 조정.
