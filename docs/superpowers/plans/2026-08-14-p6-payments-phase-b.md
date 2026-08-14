# P6 수납 처리 Phase B (은행 입금엑셀 자동매칭) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/staff/payment`에 은행 입금엑셀 업로드→컬럼매핑→매칭 미리보기→일괄 수납 확정 기능을 추가한다.

**Architecture:** Phase A `payments` 원장 위에서, 세대 식별용 `unit_accounts.payer_no`(고객번호)를 추가하고, 클라이언트에서 ExcelJS로 엑셀을 파싱·매칭(순수 함수)해 미리보기 후 배치 RPC로 기록한다. 자동 즉시기록이 아니라 사용자 확정 방식.

**Tech Stack:** Next.js(app router), Supabase(Postgres RPC + RLS), React Query, `exceljs`(read: `wb.xlsx.load`), vitest, `@/components/common`.

## Global Constraints

- 마이그레이션 = `supabase/migrations/0018_p6_payments_bank_match.sql` (0015 payments·P5c 0016/0017 다음 — 라이브 순서 준수). 라이브 적용 수동.
- `period`는 `date` 월초(`YYYY-MM-01` 문자열), 금액 `integer`, 모듈 `payment`. Phase A 규약 승계.
- 고객번호 저장 = `unit_accounts`(kind='mgmt').`payer_no text`. 은행 수납 기록 = `source='bank_excel'`, `method='transfer'`, `kind='full'`.
- payer_no 배선은 기존 `cms_member_no` 경로를 그대로 미러(스키마·폼·훅·save RPC).
- 매칭·중복판정은 미리보기에서 사용자 확정(자동 즉시기록 금지). 이름 복수후보는 미매칭.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 무관 변경 보존.

---

### Task 1: 마이그레이션 `0018_p6_payments_bank_match.sql`

**Files:**
- Create: `supabase/migrations/0018_p6_payments_bank_match.sql`

**Interfaces:**
- Consumes: `unit_accounts`(unit_id,kind,bank,account,holder,cms_member_no; unique(unit_id,kind)), `save_unit_occupancy`(0006), `list_payment_rows`(0015), `payments`(0015), `occupancies.payer_name`, 헬퍼 `current_user_org`·`current_user_has_module`·`audit_log`.
- Produces:
  - `unit_accounts.payer_no text`
  - `save_unit_occupancy` — accounts upsert에 payer_no 포함(시그니처 불변)
  - `list_payment_rows(...)` 반환에 `payer_no text, payer_name text` 추가
  - `record_bank_payments(p_building_id bigint, p_period date, p_entries jsonb) returns jsonb` → `{recorded, skipped}`
  - `list_bank_payments(p_building_id bigint, p_period date) returns table(unit_id bigint, amount int, paid_at date)`

- [ ] **Step 1: 컬럼·시그니처 검증**

Read로 확인: `0006_p3b_tenants.sql`의 `save_unit_occupancy` 전체(파라미터 시그니처 포함), `0015_p6_payments.sql`의 `list_payment_rows` 전체. 아래 재작성은 이 원본을 기준으로 한다.

- [ ] **Step 2: 마이그레이션 작성**

```sql
-- 0018_p6_payments_bank_match.sql
-- P6 Phase B: 은행 입금엑셀 자동매칭 (payer_no 고객번호 + 배치 수납)
-- 의존: P3b(unit_accounts·save_unit_occupancy·occupancies.payer_name), P6 Phase A(payments·list_payment_rows)
-- 모듈 게이트: payment / tenants(save_unit_occupancy)

-- ===== 1) 수납 고객번호 컬럼 =====
alter table unit_accounts add column if not exists payer_no text;

-- ===== 2) save_unit_occupancy: accounts upsert에 payer_no 추가 =====
-- 주의: 0006의 save_unit_occupancy 본문을 그대로 복제하되 unit_accounts upsert 루프만 아래로 교체.
--       (시그니처·다른 로직 불변) 아래 블록이 기존 insert into unit_accounts(...) 루프를 대체한다:
--   for v_item in select value from jsonb_array_elements(coalesce(p_accounts,'[]'::jsonb)) loop
--     insert into unit_accounts(unit_id, kind, bank, account, holder, cms_member_no, payer_no)
--       values (v_unit_id, v_item->>'kind', v_item->>'bank', v_item->>'account', v_item->>'holder',
--               v_item->>'cms_member_no', v_item->>'payer_no')
--       on conflict (unit_id, kind) do update set bank = excluded.bank, account = excluded.account,
--         holder = excluded.holder, cms_member_no = excluded.cms_member_no, payer_no = excluded.payer_no;
--   end loop;
-- → create or replace function save_unit_occupancy(...) 로 0006 본문 전체를 재선언(위 루프만 변경).
--   revoke/grant는 0006과 동일하게 유지(0006이 이미 부여했으면 재작성 불필요하나, 재선언 시 권한 유지 확인).

-- ===== 3) list_payment_rows: payer_no·payer_name 추가 (0015 확장) =====
create or replace function list_payment_rows(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text,
  is_vacant boolean, is_auto_debit boolean, due_date date, charged int, paid int,
  payer_no text, payer_name text
) language sql stable security definer set search_path = public as $$
  with u as (
    select id, unit_no, dong from units
    where building_id=p_building_id and deleted_at is null
      and building_id in (select id from buildings where org_id=current_user_org())
  ),
  occ as (
    select distinct on (o.unit_id) o.unit_id, o.id as occupancy_id, o.tenant_name, o.payer_name, o.status
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
    coalesce(pay.paid, 0) as paid,
    ua.payer_no,
    occ.payer_name
  from u
  left join occ on occ.unit_id=u.id
  left join pay on pay.unit_id=u.id
  left join billing_confirmations bc on bc.unit_id=u.id and bc.period=p_period
  left join lateral (
    select cms_member_no, payer_no from unit_accounts a
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

-- ===== 4) 은행 입금 일괄 기록 =====
create or replace function record_bank_payments(p_building_id bigint, p_period date, p_entries jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_item jsonb; v_unit bigint; v_amount int; v_occ bigint;
        v_recorded int := 0; v_skipped int := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if not exists (select 1 from buildings where id=p_building_id and org_id=v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if jsonb_typeof(coalesce(p_entries,'[]'::jsonb)) is distinct from 'array' then
    raise exception 'entries must be an array'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb)) loop
    v_unit := nullif(v_item->>'unit_id','')::bigint;
    v_amount := nullif(v_item->>'amount','')::int;
    if v_unit is null or coalesce(v_amount,0) <= 0 then v_skipped := v_skipped + 1; continue; end if;
    if not exists (select 1 from units uu join buildings b on b.id=uu.building_id
                   where uu.id=v_unit and uu.building_id=p_building_id and b.org_id=v_org and uu.deleted_at is null) then
      v_skipped := v_skipped + 1; continue; end if;
    select o.id into v_occ from occupancies o where o.unit_id=v_unit and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1;
    insert into payments(org_id, unit_id, period, occupancy_id, amount, method, kind, memo, paid_at, source, created_by)
      values (v_org, v_unit, p_period, v_occ, v_amount, 'transfer', 'full', nullif(v_item->>'memo',''),
              coalesce(nullif(v_item->>'paid_at','')::date, current_date), 'bank_excel', auth.uid());
    v_recorded := v_recorded + 1;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_BANK_IMPORT', 'payments', p_building_id::text,
      jsonb_build_object('period', p_period, 'recorded', v_recorded, 'skipped', v_skipped));

  return jsonb_build_object('recorded', v_recorded, 'skipped', v_skipped);
end $$;
revoke execute on function record_bank_payments(bigint, date, jsonb) from public, anon;
grant execute on function record_bank_payments(bigint, date, jsonb) to authenticated;

-- ===== 5) 은행 기존 수납(중복 감지용) =====
create or replace function list_bank_payments(p_building_id bigint, p_period date)
returns table(unit_id bigint, amount int, paid_at date)
language sql stable security definer set search_path = public as $$
  select p.unit_id, p.amount, p.paid_at
  from payments p
  join units u on u.id=p.unit_id
  join buildings b on b.id=u.building_id and b.org_id=current_user_org()
  where u.building_id=p_building_id and p.period=p_period
    and p.source='bank_excel' and p.status='active'
$$;
revoke execute on function list_bank_payments(bigint, date) from public, anon;
grant execute on function list_bank_payments(bigint, date) to authenticated;
```

- [ ] **Step 3: 셀프 체크**

`save_unit_occupancy` 재선언이 0006 본문과 accounts 루프 외 100% 동일한지, 3개 신규/변경 함수에 revoke/grant·org·module 가드가 있는지, `list_payment_rows` 반환에 payer_no/payer_name가 추가됐는지 확인.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0018_p6_payments_bank_match.sql
git commit -m "feat(payment): 은행매칭 마이그(0018) payer_no·record_bank_payments·list 확장"
```

---

### Task 2: payer_no 데이터 입력 배선 (schema·form·hooks)

기존 `cms_member_no` 경로를 그대로 미러해 payer_no를 입력·저장·조회 가능하게 한다.

**Files (Read로 정확 위치 확인 후 수정):**
- Modify: `components/forms/schema/unitAccount.ts` (payer_no 필드 추가)
- Modify: `app/(staff)/staff/buildings/[id]/components/tenant-sections/MetersAccountsSection.tsx` (payer_no 입력)
- Modify: `hooks/reactquery/unitAccounts/apis.ts` (payerNo 읽기 매핑)
- Modify: `hooks/reactquery/occupancies/apis.ts` (saveUnitOccupancy accounts payload에 payer_no)
- Test: 해당 파일들의 기존 `*.test.ts(x)` 확장

**Interfaces:**
- Consumes: Task 1 `unit_accounts.payer_no`, `save_unit_occupancy` payer_no.
- Produces: 계좌(mgmt) 입력/조회에 `payerNo` 필드. `saveUnitOccupancy`가 accounts에 `payer_no`를 전달.

- [ ] **Step 1: 기존 cms_member_no 경로 파악**

Read: 위 4개 파일에서 `cms_member_no`/`cmsMemberNo`가 어떻게 스키마 필드→폼 입력→apis 매핑→save payload로 흐르는지 확인.

- [ ] **Step 2: 스키마·폼·훅에 payer_no 추가(미러)**

`cms_member_no`가 등장하는 모든 지점에 `payer_no`(camel: `payerNo`)를 **동일 패턴으로** 추가:
- `unitAccount.ts` 스키마: `payerNo` optional string 필드(라벨 "수납 고객번호").
- `MetersAccountsSection.tsx`: mgmt 계좌 블록에 `payerNo` Input(placeholder "은행 매칭용 고객번호"). cms_member_no 입력 바로 아래.
- `unitAccounts/apis.ts`: DB row `payer_no`→`payerNo` 매핑 타입·매퍼.
- `occupancies/apis.ts`: `saveUnitOccupancy`의 accounts 매핑에 `payer_no: a.payerNo ?? null` 추가.

- [ ] **Step 3: 테스트 확장**

각 파일의 기존 테스트에 payer_no 왕복(입력→payload/매핑) 케이스를 cms_member_no 케이스와 동일하게 추가. 최소: `unitAccounts/apis.test.ts`에 `payer_no`→`payerNo` 매핑 단언, `occupancies/apis.test.ts`(있으면)에 accounts payload `payer_no` 포함 단언.

- [ ] **Step 4: 검증 + 커밋**

Run: `npx vitest run hooks/reactquery/unitAccounts hooks/reactquery/occupancies components/forms/schema` (관련 PASS)
Run: `npm run lint` · `npx tsc --noEmit`
```bash
git add components/forms/schema/unitAccount.ts "app/(staff)/staff/buildings/[id]/components/tenant-sections/MetersAccountsSection.tsx" hooks/reactquery/unitAccounts hooks/reactquery/occupancies
git commit -m "feat(payment): 수납 고객번호(payer_no) 입력·저장·조회 배선"
```

---

### Task 3: payments 훅 확장 (PaymentRow +payerNo/payerName, 은행 apis)

**Files:**
- Modify: `hooks/reactquery/payments/apis.ts` (PaymentRow 확장 + recordBankPayments + listBankPayments)
- Modify: `hooks/reactquery/payments/apis.test.ts` (추가 케이스)
- Modify: `hooks/reactquery/payments/queries.ts` (useBankPayments)
- Modify: `hooks/reactquery/payments/mutations.ts` (useRecordBankPayments)
- Modify: `hooks/reactquery/payments/keys.ts` (bank 키)

**Interfaces:**
- Consumes: Task 1 `list_payment_rows`(+payer_no/payer_name), `record_bank_payments`, `list_bank_payments`.
- Produces:
  - `PaymentRow` += `payerNo: string | null; payerName: string | null`
  - `interface BankPaymentEntry { unitId: number; amount: number; paidAt: string | null; memo?: string | null }`
  - `recordBankPayments(buildingId: number, period: string, entries: BankPaymentEntry[]): Promise<{ recorded: number; skipped: number }>`
  - `interface BankPaymentRef { unitId: number; amount: number; paidAt: string }`
  - `listBankPayments(buildingId: number, period: string): Promise<BankPaymentRef[]>`
  - hooks `useRecordBankPayments()`, `useBankPayments(buildingId, period)`; `paymentKeys.bank(buildingId, period)`

- [ ] **Step 1: 실패 테스트 추가**

`apis.test.ts`에 추가:
```ts
describe("listPaymentRows payerNo/payerName", () => {
  it("payer_no·payer_name 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 1, unit_no: "101", dong: "A", occupancy_id: 9, tenant_name: "김철수",
      is_vacant: false, is_auto_debit: false, due_date: null, charged: 10000, paid: 0,
      payer_no: "C-100", payer_name: "김납부",
    }], error: null });
    const rows = await listPaymentRows(1, "2026-08-01");
    expect(rows[0]).toMatchObject({ payerNo: "C-100", payerName: "김납부" });
  });
});

describe("recordBankPayments", () => {
  it("entries를 snake로 전달하고 결과 반환", async () => {
    rpc.mockResolvedValue({ data: { recorded: 2, skipped: 1 }, error: null });
    const res = await recordBankPayments(3, "2026-08-01", [
      { unitId: 11, amount: 5000, paidAt: "2026-08-10", memo: "홍길동" },
    ]);
    expect(rpc).toHaveBeenCalledWith("record_bank_payments", {
      p_building_id: 3, p_period: "2026-08-01",
      p_entries: [{ unit_id: 11, amount: 5000, paid_at: "2026-08-10", memo: "홍길동" }],
    });
    expect(res).toEqual({ recorded: 2, skipped: 1 });
  });
});

describe("listBankPayments", () => {
  it("기존 은행수납 반환", async () => {
    rpc.mockResolvedValue({ data: [{ unit_id: 11, amount: 5000, paid_at: "2026-08-10" }], error: null });
    const refs = await listBankPayments(3, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_bank_payments", { p_building_id: 3, p_period: "2026-08-01" });
    expect(refs[0]).toEqual({ unitId: 11, amount: 5000, paidAt: "2026-08-10" });
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run hooks/reactquery/payments/apis.test.ts` → FAIL.

- [ ] **Step 3: apis.ts 확장**

`PaymentRow`에 `payerNo`/`payerName`, `PaymentRowDb`에 `payer_no`/`payer_name` 추가하고 매퍼에 반영. 추가:
```ts
export interface BankPaymentEntry { unitId: number; amount: number; paidAt: string | null; memo?: string | null; }
export interface BankPaymentRef { unitId: number; amount: number; paidAt: string; }

export async function recordBankPayments(
  buildingId: number, period: string, entries: BankPaymentEntry[],
): Promise<{ recorded: number; skipped: number }> {
  const { data, error } = await createClient().rpc("record_bank_payments", {
    p_building_id: buildingId, p_period: period,
    p_entries: entries.map((e) => ({ unit_id: e.unitId, amount: e.amount, paid_at: e.paidAt ?? null, memo: e.memo ?? null })),
  });
  if (error) throw new Error(error.message);
  const r = data as { recorded: number; skipped: number };
  return { recorded: r.recorded, skipped: r.skipped };
}

export async function listBankPayments(buildingId: number, period: string): Promise<BankPaymentRef[]> {
  const { data, error } = await createClient().rpc("list_bank_payments", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { unit_id: number; amount: number; paid_at: string }[])
    .map((r) => ({ unitId: r.unit_id, amount: r.amount, paidAt: r.paid_at }));
}
```
`PaymentRow` 매퍼에 `payerNo: r.payer_no, payerName: r.payer_name` 추가.

- [ ] **Step 4: keys/queries/mutations**

`keys.ts`: `bank: (buildingId: number, period: string) => ["payments","bank",buildingId,period] as const`.
`queries.ts`:
```ts
export function useBankPayments(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.bank(buildingId ?? 0, period),
    queryFn: () => listBankPayments(buildingId as number, period),
    enabled: buildingId !== null && Boolean(period),
  });
}
```
`mutations.ts`:
```ts
export function useRecordBankPayments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { buildingId: number; period: string; entries: BankPaymentEntry[] }) =>
      recordBankPayments(v.buildingId, v.period, v.entries),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.all }),
  });
}
```
(import `BankPaymentEntry`, `recordBankPayments`, `listBankPayments`.)

- [ ] **Step 5: 통과 + 커밋**

Run: `npx vitest run hooks/reactquery/payments` (PASS) · `npm run lint`
```bash
git add hooks/reactquery/payments
git commit -m "feat(payment): payments 훅 은행매칭 확장(payerNo·recordBankPayments·listBankPayments)"
```

---

### Task 4: 순수 파싱·매칭 로직 (`lib/payments/bankParse.ts`, `match.ts`)

**Files:**
- Create: `lib/payments/bankParse.ts` + `lib/payments/bankParse.test.ts`
- Create: `lib/payments/match.ts` + `lib/payments/match.test.ts`

**Interfaces:**
- Produces:
  - `interface ParsedSheet { headers: string[]; rows: string[][] }`
  - `parseBankWorkbook(buffer: ArrayBuffer): Promise<ParsedSheet>`
  - `interface ColumnMapping { customerNo: number | null; name: number | null; amount: number | null; paidAt: number | null }`
  - `guessColumns(headers: string[]): ColumnMapping`
  - `parseAmount(raw: string): number`
  - `interface Deposit { customerNo: string; name: string; amount: number; paidAt: string | null; rowIndex: number }`
  - `toDeposits(rows: string[][], mapping: ColumnMapping): Deposit[]`
  - `interface MatchUnit { unitId: number; unitNo: string; payerNo: string | null; payerName: string | null; tenantName: string | null; unpaid: number | null }`
  - `interface MatchedDeposit { deposit: Deposit; unitId: number; unitNo: string; unpaid: number | null; delta: number | null }`
  - `interface MatchResult { matched: MatchedDeposit[]; unmatched: Deposit[] }`
  - `matchDeposits(deposits: Deposit[], units: MatchUnit[]): MatchResult`
  - `normalizeName(s: string): string`

- [ ] **Step 1: bankParse 순수 테스트 작성**

`lib/payments/bankParse.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { guessColumns, parseAmount, parseBankWorkbook, toDeposits } from "./bankParse";

describe("parseAmount", () => {
  it("콤마·원·통화기호 제거", () => {
    expect(parseAmount("1,234")).toBe(1234);
    expect(parseAmount("₩10,000원")).toBe(10000);
    expect(parseAmount(" 5000 ")).toBe(5000);
  });
  it("빈값·비숫자 → 0", () => { expect(parseAmount("")).toBe(0); expect(parseAmount("-")).toBe(0); });
});

describe("guessColumns", () => {
  it("헤더 동의어로 열 추측", () => {
    const m = guessColumns(["입금일", "고객번호", "입금자명", "금액"]);
    expect(m).toEqual({ paidAt: 0, customerNo: 1, name: 2, amount: 3 });
  });
});

describe("toDeposits", () => {
  it("매핑으로 Deposit 생성·빈행 skip", () => {
    const rows = [["2026-08-10","C-1","홍길동","10,000"], ["","","",""]];
    const deps = toDeposits(rows, { paidAt: 0, customerNo: 1, name: 2, amount: 3 });
    expect(deps).toEqual([{ customerNo: "C-1", name: "홍길동", amount: 10000, paidAt: "2026-08-10", rowIndex: 0 }]);
  });
});

describe("parseBankWorkbook", () => {
  it("xlsx 버퍼 → headers/rows", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.addRow(["고객번호", "입금자명", "금액"]);
    ws.addRow(["C-1", "홍길동", "10000"]);
    const buf = await wb.xlsx.writeBuffer();
    const parsed = await parseBankWorkbook(buf as ArrayBuffer);
    expect(parsed.headers).toEqual(["고객번호", "입금자명", "금액"]);
    expect(parsed.rows[0]).toEqual(["C-1", "홍길동", "10000"]);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run lib/payments/bankParse.test.ts` → FAIL.

- [ ] **Step 3: bankParse.ts 구현**

```ts
import ExcelJS from "exceljs";

export interface ParsedSheet { headers: string[]; rows: string[][]; }
export interface ColumnMapping { customerNo: number | null; name: number | null; amount: number | null; paidAt: number | null; }
export interface Deposit { customerNo: string; name: string; amount: number; paidAt: string | null; rowIndex: number; }

const cell = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "object" && "text" in (v as Record<string, unknown>)) return String((v as { text: unknown }).text ?? "");
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

export async function parseBankWorkbook(buffer: ArrayBuffer): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const matrix: string[][] = [];
  ws.eachRow((row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    matrix.push(values.map(cell));
  });
  const [headers = [], ...rows] = matrix;
  return { headers, rows };
}

const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  customerNo: ["고객번호", "회원번호", "수용가", "고객"],
  name: ["입금자", "성명", "이름", "예금주", "보낸분"],
  amount: ["금액", "입금액", "입금", "amount"],
  paidAt: ["입금일", "거래일", "일자", "date"],
};

export function guessColumns(headers: string[]): ColumnMapping {
  const find = (hints: string[]) => {
    const i = headers.findIndex((h) => hints.some((k) => h.replace(/\s/g, "").includes(k)));
    return i >= 0 ? i : null;
  };
  return {
    customerNo: find(HEADER_HINTS.customerNo),
    name: find(HEADER_HINTS.name),
    amount: find(HEADER_HINTS.amount),
    paidAt: find(HEADER_HINTS.paidAt),
  };
}

export function parseAmount(raw: string): number {
  const neg = /^\s*\(.*\)\s*$/.test(raw);
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return neg ? -Math.round(n) : Math.round(n);
}

const at = (row: string[], i: number | null) => (i == null ? "" : (row[i] ?? "").trim());

export function toDeposits(rows: string[][], mapping: ColumnMapping): Deposit[] {
  const out: Deposit[] = [];
  rows.forEach((row, rowIndex) => {
    const customerNo = at(row, mapping.customerNo);
    const name = at(row, mapping.name);
    const amount = parseAmount(at(row, mapping.amount));
    const paidAtRaw = at(row, mapping.paidAt);
    if (!customerNo && !name && amount === 0) return; // 빈행
    out.push({ customerNo, name, amount, paidAt: paidAtRaw || null, rowIndex });
  });
  return out;
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run lib/payments/bankParse.test.ts` → PASS.

- [ ] **Step 5: match 테스트 작성**

`lib/payments/match.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { matchDeposits, normalizeName } from "./match";
import type { Deposit } from "./bankParse";

const dep = (o: Partial<Deposit>): Deposit => ({ customerNo: "", name: "", amount: 0, paidAt: null, rowIndex: 0, ...o });
const units = [
  { unitId: 1, unitNo: "101", payerNo: "C-1", payerName: "김납부", tenantName: "김철수", unpaid: 10000 },
  { unitId: 2, unitNo: "102", payerNo: null, payerName: null, tenantName: "이영희", unpaid: 5000 },
  { unitId: 3, unitNo: "103", payerNo: null, payerName: null, tenantName: "이영희", unpaid: 3000 },
];

describe("matchDeposits", () => {
  it("고객번호 정확일치 우선 + 차액", () => {
    const r = matchDeposits([dep({ customerNo: "C-1", name: "아무개", amount: 4000 })], units);
    expect(r.matched[0]).toMatchObject({ unitId: 1, delta: -6000 });
    expect(r.unmatched).toHaveLength(0);
  });
  it("고객번호 미스 → 이름 단일일치", () => {
    const r = matchDeposits([dep({ name: "이 영희", amount: 5000 })], units.slice(1, 2));
    expect(r.matched[0].unitId).toBe(2);
  });
  it("이름 복수후보 → 미매칭", () => {
    const r = matchDeposits([dep({ name: "이영희", amount: 5000 })], units);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatched).toHaveLength(1);
  });
  it("아무 매칭 없음 → 미매칭", () => {
    const r = matchDeposits([dep({ customerNo: "X", name: "누구", amount: 1 })], units);
    expect(r.unmatched).toHaveLength(1);
  });
  it("unpaid null이면 delta null", () => {
    const r = matchDeposits([dep({ customerNo: "C-9", amount: 1000 })],
      [{ unitId: 9, unitNo: "9", payerNo: "C-9", payerName: null, tenantName: null, unpaid: null }]);
    expect(r.matched[0].delta).toBeNull();
  });
});

describe("normalizeName", () => {
  it("공백·괄호 제거·소문자", () => { expect(normalizeName(" 김 철수(101) ")).toBe(normalizeName("김철수")); });
});
```

- [ ] **Step 6: match.ts 구현**

```ts
import type { Deposit } from "./bankParse";

export interface MatchUnit { unitId: number; unitNo: string; payerNo: string | null; payerName: string | null; tenantName: string | null; unpaid: number | null; }
export interface MatchedDeposit { deposit: Deposit; unitId: number; unitNo: string; unpaid: number | null; delta: number | null; }
export interface MatchResult { matched: MatchedDeposit[]; unmatched: Deposit[]; }

export function normalizeName(s: string): string {
  return (s ?? "").replace(/[\s()（）]/g, "").replace(/\d+/g, "").toLocaleLowerCase("ko-KR");
}

export function matchDeposits(deposits: Deposit[], units: MatchUnit[]): MatchResult {
  const byPayerNo = new Map<string, MatchUnit>();
  for (const u of units) if (u.payerNo) byPayerNo.set(u.payerNo.trim(), u);

  const matched: MatchedDeposit[] = [];
  const unmatched: Deposit[] = [];

  for (const d of deposits) {
    let hit: MatchUnit | undefined;
    if (d.customerNo && byPayerNo.has(d.customerNo.trim())) {
      hit = byPayerNo.get(d.customerNo.trim());
    } else if (d.name) {
      const key = normalizeName(d.name);
      const cands = units.filter(
        (u) => (u.payerName && normalizeName(u.payerName) === key) || (u.tenantName && normalizeName(u.tenantName) === key),
      );
      if (cands.length === 1) hit = cands[0];
    }
    if (!hit) { unmatched.push(d); continue; }
    matched.push({
      deposit: d, unitId: hit.unitId, unitNo: hit.unitNo, unpaid: hit.unpaid,
      delta: hit.unpaid == null ? null : d.amount - hit.unpaid,
    });
  }
  return { matched, unmatched };
}
```

- [ ] **Step 7: 통과 + 커밋**

Run: `npx vitest run lib/payments/bankParse.test.ts lib/payments/match.test.ts` (PASS) · `npm run lint`
```bash
git add lib/payments/bankParse.ts lib/payments/bankParse.test.ts lib/payments/match.ts lib/payments/match.test.ts
git commit -m "feat(payment): 은행엑셀 파싱·세대 매칭 순수 로직"
```

---

### Task 5: 업로드 모달 + 페이지 배선 + 통합 테스트

**Files:**
- Create: `app/(staff)/staff/payment/components/BankImportModal.tsx`
- Modify: `app/(staff)/staff/payment/page.tsx` (엑셀 업로드 버튼 + 모달)
- Test: `app/(staff)/staff/payment/components/BankImportModal.test.tsx`

**Interfaces:**
- Consumes: Task 3 훅(`usePaymentRows`(payerNo/payerName), `useBankPayments`, `useRecordBankPayments`), Task 4 `parseBankWorkbook`·`guessColumns`·`toDeposits`·`matchDeposits`, `ComplaintDialog`·`@/components/common`, `sonner`.
- Produces: `BankImportModal` (props `{ open; buildingId: number; period: string; rows: PaymentRow[]; onClose(): void }`).

- [ ] **Step 1: BankImportModal 작성**

`ComplaintDialog`(size="large") 기반. 단계 state: `select`→`map`→`preview`.
- 파일 input(`accept=".xlsx"`) → `file.arrayBuffer()` → `parseBankWorkbook` → headers/rows 저장 → `guessColumns` 초기 매핑 → `map`.
- 매핑: 4개 Select(customerNo/name/amount/paidAt), 옵션 = headers 인덱스. 변경 시 `toDeposits`→`matchDeposits(deposits, rowsToMatchUnits(props.rows))` 재계산. `rowsToMatchUnits`: PaymentRow→MatchUnit(payerNo/payerName/tenantName/unpaid/unitNo).
- 중복: `useBankPayments(buildingId, period)` 결과로 matched에 `isDuplicate`(같은 unitId·amount·paidAt) 부여, 기본 체크 해제.
- preview: matched 표(호실·입금자·입금액·미납·차액 부분/초과 뱃지·중복 뱃지·체크박스) + unmatched 표(입금자·금액·입금일 + 세대 Select 수동지정 → 지정 시 matched로 이동). 상단 요약(매칭 N·미매칭 M·중복 K).
- 확정: 체크된 matched → `useRecordBankPayments().mutateAsync({ buildingId, period, entries })` (entries={unitId, amount, paidAt, memo=입금자명}). 성공 `toast.success("N건 수납 처리")`, `onClose`.

- [ ] **Step 2: page.tsx 배선**

상단 액션 영역에 `엑셀 업로드` 버튼 추가 → `bankOpen` state로 `BankImportModal` 오픈(`buildingId=selectedBuildingId`, `period`, `rows`). `selectedBuildingId===null`이면 버튼 비활성.

- [ ] **Step 3: 통합 테스트**

`BankImportModal.test.tsx` — `vi.mock`으로 `parseBankWorkbook`(고정 headers/rows 반환)·`useBankPayments`(빈 배열)·`useRecordBankPayments`(mutateAsync spy). 케이스:
```
1) 파일 업로드→매핑 자동추측→preview에 매칭행(호실·차액) 표시
2) 확정 클릭 시 useRecordBankPayments.mutateAsync가 {buildingId, period, entries:[{unitId, amount}]}로 호출
3) 이름 복수후보 deposit은 미매칭 영역에 표시
```
(`parseBankWorkbook` mock으로 ExcelJS 의존 제거; matchDeposits는 실제 사용.)

- [ ] **Step 4: 실패→구현→통과** — `npx vitest run "app/(staff)/staff/payment/components/BankImportModal.test.tsx"` 최종 PASS.

- [ ] **Step 5: 전체 검증 + 커밋**

Run: `npx vitest run` (전체 그린; 사전 실패는 무관 범위로 명시) · `npm run lint` · `npx tsc --noEmit`
```bash
git add "app/(staff)/staff/payment/components/BankImportModal.tsx" "app/(staff)/staff/payment/components/BankImportModal.test.tsx" "app/(staff)/staff/payment/page.tsx"
git commit -m "feat(payment): 은행 입금엑셀 업로드·매핑·미리보기·일괄확정 모달"
```

---

## Self-Review (작성자 체크 완료)

**Spec 커버리지**: §3.1 payer_no=T1·T2 · §3.2 list_payment_rows 확장=T1·T3 · §3.3 record_bank_payments=T1·T3 · §3.4 list_bank_payments=T1·T3 · §4 파싱=T4 · §5 매칭=T4 · §6 UI=T5 · §8 테스트=각 태스크. 범위 밖(C·D·CMS결과·연체료) 제외 — 일치.

**플레이스홀더**: SQL·순수로직·apis·테스트 완전 코드. `save_unit_occupancy` 재선언은 0006 복제+지정 3줄 변경(정확 블록 제시). T2·T5 UI는 정확 props 계약 + cms_member_no 미러 지시 + 수용기준. "적절히" 류 없음.

**타입 일관성**: `Deposit`/`MatchUnit`/`MatchedDeposit`/`MatchResult` T4 정의를 T5가 소비. `BankPaymentEntry`(unitId/amount/paidAt/memo) T3↔T5 일치. `PaymentRow.payerNo/payerName` T1(SQL)→T3(apis)→T5(rowsToMatchUnits) 일치. RPC 인자(p_entries=[{unit_id,amount,paid_at,memo}]) T1↔T3 일치.

**유의**: `save_unit_occupancy`는 0006 본문 복제가 필요 — T1 Step1에서 원본 확인 필수. SQL 무단위테스트(라이브 수동). `parseBankWorkbook`은 T5 통합테스트에서 mock(ExcelJS 브라우저 의존 회피), 순수 helper는 T4에서 실테스트.
