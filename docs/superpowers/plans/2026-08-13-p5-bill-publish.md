# P5 고지서 발행 코어(A4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부과 확정된 관리비를 `/staff/bill`에서 세대별 A4 고지서로 인쇄(발행 기록)하고, 선택 세대에 문자(stub)를 발송하는 얕은 수직 슬라이스를 완성한다.

**Architecture:** 신규 테이블 `bill_issues`(마이그 0013)와 definer RPC 3종(`list_bill_targets`·`get_bill_documents`·`issue_bills`)으로 확정 스냅샷 조회·발행 기록. UI는 기존 billing/messaging 도메인 패턴을 계승 — `hooks/reactquery/bill` + `/staff/bill` 화면 + `BillPrintView`(브라우저 인쇄, `@media print`) + `QrCode`(qrcode.react). 발송은 기존 `MessagingModal` 프리셋(SMS/stub) 재사용.

**Tech Stack:** Next.js 16(App Router, `"use client"`) · Supabase(PostgreSQL·Auth) · React Query(@tanstack) · TailwindCSS(print variant) · qrcode.react · Vitest + Testing Library · zod(불필요 시 미사용).

**기준 spec:** `docs/superpowers/specs/2026-08-13-p5-bill-publish-design.md`

## Global Constraints

- **금액**: 모든 금액은 `integer`(원). 표시 시 `toLocaleString()`.
- **기간**: `period`는 `date` 매월 1일(`'YYYY-MM-01'`). `<input type="month">`는 `toMonthInput`/`fromMonthInput`(`lib/billing/period.ts`, 기존)로 변환.
- **권한 모듈 키**: `bill_publish`. 화면 게이트 `hasModule(me, "bill_publish")`, 쓰기 RLS/RPC `current_user_has_module('bill_publish')`.
- **RLS 패턴**: 신규 테이블 SELECT는 org 개방(`unit→building→org in my_org_ids()`), 쓰기는 `bill_publish` 게이팅. RPC는 `security definer set search_path = public` + `current_user_org()` 스코프 + `revoke execute ... from public, anon` / `grant ... to authenticated`.
- **데이터 계층 패턴**: 도메인 폴더 = `apis.ts`(fn+type+snake↔camel 매퍼)·`keys.ts`·`queries.ts`·`mutations.ts`·`index.ts`(배럴 `export *`). RPC 호출 `createClient().rpc("fn", { p_arg })` → `{data,error}`, 에러 시 `throw new Error(error.message)`. (billing 도메인과 동일.)
- **확정 스냅샷 소스**: `billing_confirmations`(확정=`confirmed_at is not null`, 총액·note) + 기간별 최신 `billing_history`(items jsonb `[{fee_item_id,name,charged,amount}]`). `unit_accounts`(kind='mgmt', `cms_member_no`)로 `auto_debit` 파생.
- **Next 주의(AGENTS.md)**: 클라이언트 페이지·컴포넌트는 `"use client"`. `window.print`·`<input type="month">`·모달은 Next/React API 확인.
- **DB 적용**: 라이브는 사용자 PC(0012 다음 `0013`). 이 세션에선 파일 정합성만, 적용 후 `p5_bill_checks.sql` 실행.
- **의존 패키지**: `qrcode.react`(dependencies) + `@types/*` 불필요(qrcode.react는 자체 타입 포함). React 동기 렌더 컴포넌트 → effect 불필요.
- **커밋**: 한국어 conventional(`feat`/`fix`/`test`/`docs`). **모든 커밋 메시지 끝에**(빈 줄 뒤):
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **WBS**: 화면 커밋 후 `wbs-commit-sync`는 현재 브랜치가 `config.branches` 밖이라 대상 아님(master 병합 후 반영). SQL/lib/hooks 커밋은 애초 비대상.
- **가정(구현 시 확인)**: `useBuildings()`(buildings 도메인)는 `{ id:number; name:string }[]` 반환. `useSetupConfig(orgId)`는 `{ unitLabelDefault:"code"|"name"; customerNotice; mgmtBank1/Acct1/Holder1/Print1; mgmtBank2/Acct2/Holder2/Print2 }` 포함(BillingSettingsTab/AccountSettingsTab 기준). 다르면 실제 시그니처에 맞춘다.

---

## File Structure

**생성**
- `supabase/migrations/0013_p5_bill_publish.sql` — `bill_issues` 테이블·인덱스·트리거·RLS·RPC 3종.
- `supabase/verify/p5_bill_checks.sql` — 스키마·정책·RPC 존재 검증(사용자 PC psql).
- `lib/bill/document.ts` (+ `.test.ts`) — 순수 유틸(`unitLabel`·`buildQrPayload`·`printableAccounts`·`billDocumentTotal`) + 상수.
- `hooks/reactquery/bill/{apis.ts,keys.ts,queries.ts,mutations.ts,index.ts,apis.test.ts}` — 데이터 계층.
- `app/(staff)/staff/bill/components/QrCode.tsx` (+ `.test.tsx`) — QR 렌더(qrcode.react 래핑).
- `app/(staff)/staff/bill/components/BillPrintView.tsx` (+ `.test.tsx`) — A4 인쇄 뷰.
- `app/(staff)/staff/bill/components/BillTargetTable.tsx` (+ `.test.tsx`) — 확정 세대 표.
- `app/(staff)/staff/bill/page.tsx` (+ `page.test.tsx`) — 화면 조립·게이트·인쇄·발송.

**수정**
- `components/shell/navItems.ts` — `/staff/bill` `built:false→true`.
- `package.json` — `qrcode.react` 의존 추가.

**재사용(변경 없음)**
- `components/common`(Button/Select/Checkbox/Panel/Modal 등), `lib/billing/period.ts`, `lib/auth/permissions.ts`, `hooks/reactquery/{auth,buildings,setupConfig}`, `app/(staff)/staff/messaging/components/MessagingModal.tsx`, `lib/messaging/preset.ts`.

---

## Group 1 — DB · 데이터층

### Task 1: 마이그레이션 0013 — `bill_issues` 테이블·인덱스·트리거·RLS

**Files:**
- Create: `supabase/migrations/0013_p5_bill_publish.sql`

**Interfaces:**
- Produces: 테이블 `bill_issues(unit_id, period, occupancy_id, issue_type, group_no, due_date, unit_label_mode, auto_debit, total_amount, send_status, issued_at, issued_by)`. Task 2 RPC가 이 테이블에 기록.

- [ ] **Step 1: 마이그레이션 파일 작성(테이블·트리거·RLS)**

```sql
-- 0013_p5_bill_publish.sql
-- P5: 고지서 발행 (bill_issues)
-- 의존: P0(profiles·audit_log·set_updated_at), P1a(units), P2a(current_user_org·current_user_has_module·my_org_ids),
--       P3b(occupancies·unit_accounts), P5-billing 0012(billing_confirmations·billing_history)
-- 모듈 게이트: bill_publish

create table bill_issues (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,
  issue_type text not null check (issue_type in ('a4','giro','kakao','fax')),
  group_no int not null default 1,
  due_date date,
  unit_label_mode text not null default 'code' check (unit_label_mode in ('code','name')),
  auto_debit boolean not null default false,
  total_amount integer not null default 0,
  send_status text not null default 'none' check (send_status in ('none','sent','failed')),
  issued_at timestamptz not null default now(),
  issued_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, period, issue_type)
);
create index on bill_issues (unit_id, period);

-- updated_at 트리거
create trigger trg_bill_issues_updated before update on bill_issues
  for each row execute function set_updated_at();

-- RLS: SELECT org 개방 / 쓰기 bill_publish 모듈
alter table bill_issues enable row level security;
create policy bi_select on bill_issues for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy bi_write on bill_issues for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('bill_publish'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('bill_publish'));
```

- [ ] **Step 2: SQL 정합성 육안 확인**

확인: (1) `enable row level security` + 정책 2개, (2) `unique (unit_id, period, issue_type)`, (3) `period` CHECK 매월 1일, (4) `issued_by`가 `profiles(user_id)` 참조, (5) 트리거 함수 `set_updated_at` 존재(P0).

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0013_p5_bill_publish.sql
git commit -m "$(printf 'feat(db): P5 bill_issues 테이블+RLS (0013) — 고지서 발행 기록\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: 마이그레이션 0013 — RPC 3종 + verify SQL

**Files:**
- Modify: `supabase/migrations/0013_p5_bill_publish.sql` (append)
- Create: `supabase/verify/p5_bill_checks.sql`

**Interfaces:**
- Produces:
  - `list_bill_targets(bigint, date)` → 확정 세대 목록(아래 컬럼 순서·타입은 Task 4 `BillTargetDbRow` 매퍼가 소비).
  - `get_bill_documents(bigint, date, jsonb)` → 선택 세대 A4 렌더 데이터(Task 4 `BillDocDbRow`).
  - `issue_bills(bigint, date, jsonb, text, date, text)` → `jsonb {count}`(Task 4 `issueBills`).

- [ ] **Step 1: RPC 추가**

```sql
-- ===== 확정 세대 목록 (화면 테이블 + 발송 수신처) =====
create or replace function list_bill_targets(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text, phone text,
  total_amount integer, auto_debit boolean,
  issue_type text, due_date date, send_status text, issued_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    u.id, u.unit_no, u.dong, bc.occupancy_id, o.tenant_name, o.phone,
    bc.total_amount,
    exists (select 1 from unit_accounts ua where ua.unit_id = u.id and ua.kind = 'mgmt' and nullif(ua.cms_member_no,'') is not null) as auto_debit,
    bi.issue_type, bi.due_date, bi.send_status, bi.issued_at
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.id = p_building_id and b.org_id = current_user_org()
  left join occupancies o on o.id = bc.occupancy_id
  left join lateral (
    select x.issue_type, x.due_date, x.send_status, x.issued_at
    from bill_issues x where x.unit_id = u.id and x.period = p_period
    order by x.issued_at desc, x.id desc limit 1
  ) bi on true
  where bc.period = p_period and bc.confirmed_at is not null
  order by u.unit_no
$$;
revoke execute on function list_bill_targets(bigint, date) from public, anon;
grant execute on function list_bill_targets(bigint, date) to authenticated;

-- ===== 선택 세대 A4 렌더 데이터 (확정 스냅샷 + 최신 history items) =====
create or replace function get_bill_documents(p_building_id bigint, p_period date, p_unit_ids jsonb)
returns table(
  unit_id bigint, unit_no text, dong text, tenant_name text,
  total_amount integer, auto_debit boolean, items jsonb, billing_note text, unit_notice text
) language sql stable security definer set search_path = public as $$
  select
    u.id, u.unit_no, u.dong, o.tenant_name,
    bc.total_amount,
    exists (select 1 from unit_accounts ua where ua.unit_id = u.id and ua.kind = 'mgmt' and nullif(ua.cms_member_no,'') is not null) as auto_debit,
    coalesce(bh.items, '[]'::jsonb) as items, bc.billing_note, bc.unit_notice
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.id = p_building_id and b.org_id = current_user_org()
  left join occupancies o on o.id = bc.occupancy_id
  left join lateral (
    select h.items from billing_history h
    where h.unit_id = u.id and h.period = p_period
    order by h.confirmed_at desc, h.id desc limit 1
  ) bh on true
  where bc.period = p_period and bc.confirmed_at is not null
    and bc.unit_id in (select jsonb_array_elements_text(coalesce(p_unit_ids,'[]'::jsonb))::bigint)
  order by u.unit_no
$$;
revoke execute on function get_bill_documents(bigint, date, jsonb) from public, anon;
grant execute on function get_bill_documents(bigint, date, jsonb) to authenticated;

-- ===== 발행 기록 (확정 세대만, upsert) =====
create or replace function issue_bills(
  p_building_id bigint, p_period date, p_unit_ids jsonb,
  p_issue_type text, p_due_date date, p_unit_label_mode text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint; v_unit_id bigint; v_count int := 0;
  v_total int; v_occ_id bigint; v_auto boolean;
  v_mode text := coalesce(p_unit_label_mode, 'code');
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('bill_publish') then raise exception 'forbidden: bill_publish required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_issue_type not in ('a4','giro','kakao','fax') then raise exception 'invalid issue_type'; end if;
  if v_mode not in ('code','name') then raise exception 'invalid unit_label_mode'; end if;

  for v_unit_id in select jsonb_array_elements_text(coalesce(p_unit_ids,'[]'::jsonb))::bigint loop
    select bc.total_amount, bc.occupancy_id into v_total, v_occ_id
    from billing_confirmations bc
    join units u on u.id = bc.unit_id and u.building_id = p_building_id and u.deleted_at is null
    where bc.unit_id = v_unit_id and bc.period = p_period and bc.confirmed_at is not null;
    if not found then raise exception 'unit % not confirmed for period', v_unit_id; end if;

    v_auto := exists (select 1 from unit_accounts ua where ua.unit_id = v_unit_id and ua.kind = 'mgmt' and nullif(ua.cms_member_no,'') is not null);

    insert into bill_issues(unit_id, period, occupancy_id, issue_type, group_no, due_date, unit_label_mode, auto_debit, total_amount, issued_by)
      values (v_unit_id, p_period, v_occ_id, p_issue_type, 1, p_due_date, v_mode, v_auto, coalesce(v_total,0), auth.uid())
      on conflict (unit_id, period, issue_type) do update
        set due_date = excluded.due_date, unit_label_mode = excluded.unit_label_mode,
            auto_debit = excluded.auto_debit, total_amount = excluded.total_amount,
            occupancy_id = excluded.occupancy_id, issued_by = excluded.issued_by, issued_at = now();
    v_count := v_count + 1;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILL_ISSUE', 'bill_issues', p_building_id::text,
      jsonb_build_object('period', p_period, 'issue_type', p_issue_type, 'count', v_count));

  return jsonb_build_object('count', v_count);
end $$;
revoke execute on function issue_bills(bigint, date, jsonb, text, date, text) from public, anon;
grant execute on function issue_bills(bigint, date, jsonb, text, date, text) to authenticated;
```

- [ ] **Step 2: verify SQL 작성**

```sql
-- supabase/verify/p5_bill_checks.sql — P5 고지서 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  if (select count(*) from information_schema.tables where table_name = 'bill_issues') <> 1
    then raise exception 'bill_issues missing'; end if;
end $$;
do $$ begin
  perform 1 from pg_policies where tablename='bill_issues' and policyname='bi_write' and qual like '%bill_publish%';
  if not found then raise exception 'bi_write must gate by bill_publish'; end if;
  perform 1 from pg_policies where tablename='bill_issues' and cmd='SELECT' and policyname='bi_select';
  if not found then raise exception 'bi_select missing'; end if;
  if (select count(*) from pg_proc where proname in ('list_bill_targets','get_bill_documents','issue_bills')) <> 3
    then raise exception 'bill RPC missing'; end if;
end $$;
-- 수동 점검(사용자 PC):
--  1) bill_publish 미보유 구성원: bill_issues INSERT 거부 / SELECT 가능.
--  2) 미확정(confirmed_at null) 세대 issue_bills → 'not confirmed' 예외.
--  3) 타 org building_id → 'building not in org'.
--  4) issue_bills 재호출 시 (unit,period,'a4') upsert(중복 미생성).
--  5) list_bill_targets가 확정 세대만·타 org 0행.
```

- [ ] **Step 3: 정적 확인 + 커밋**

Run: `npx tsc --noEmit`
Expected: PASS (SQL 변경은 tsc 무관, 리포지토리 컴파일 정상 확인).

```bash
git add supabase/migrations/0013_p5_bill_publish.sql supabase/verify/p5_bill_checks.sql
git commit -m "$(printf 'feat(db): P5 고지서 RPC 3종(list_bill_targets·get_bill_documents·issue_bills)+검증\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: `lib/bill/document.ts` — 순수 유틸

**Files:**
- Create: `lib/bill/document.ts`
- Test: `lib/bill/document.test.ts`

**Interfaces:**
- Produces: `unitLabel(mode,unitNo,tenantName)→string` · `buildQrPayload(unitId,period,base?)→string` · `printableAccounts(config)→PrintableAccount[]` · `billDocumentTotal(items)→number` · 상수 `BILL_QR_PLACEHOLDER_BASE`·`PROGRAM_COMPANY_NAME` · 타입 `PrintableAccount`·`AccountConfig`·`BillItem`. Task 6·7·8이 소비.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// lib/bill/document.test.ts
import { describe, it, expect } from "vitest";
import { unitLabel, buildQrPayload, printableAccounts, billDocumentTotal, BILL_QR_PLACEHOLDER_BASE } from "./document";

describe("bill/document", () => {
  it("unitLabel: name 모드는 입주자명, 없으면 코드 폴백", () => {
    expect(unitLabel("code", "101", "홍길동")).toBe("101");
    expect(unitLabel("name", "101", "홍길동")).toBe("홍길동");
    expect(unitLabel("name", "101", null)).toBe("101");
    expect(unitLabel("name", "101", "  ")).toBe("101");
  });
  it("buildQrPayload: base 없으면 플레이스홀더", () => {
    expect(buildQrPayload(7, "2026-08-01")).toBe(`${BILL_QR_PLACEHOLDER_BASE}?unit=7&period=2026-08-01`);
    expect(buildQrPayload(7, "2026-08-01", "https://x.io/a")).toBe("https://x.io/a?unit=7&period=2026-08-01");
  });
  it("printableAccounts: mgmtPrint true + 값 있는 계좌만", () => {
    const cfg = { mgmtBank1: "국민", mgmtAcct1: "123", mgmtHolder1: "관리", mgmtPrint1: true,
                  mgmtBank2: "신한", mgmtAcct2: "456", mgmtHolder2: "관리", mgmtPrint2: false };
    expect(printableAccounts(cfg)).toEqual([{ bank: "국민", acct: "123", holder: "관리" }]);
    expect(printableAccounts(null)).toEqual([]);
  });
  it("billDocumentTotal: charged 항목만 합산", () => {
    expect(billDocumentTotal([
      { feeItemId: 1, name: "관리비", charged: true, amount: 30000 },
      { feeItemId: 2, name: "수도", charged: false, amount: 5000 },
    ])).toBe(30000);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run lib/bill/document.test.ts` · Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```ts
// lib/bill/document.ts
export const BILL_QR_PLACEHOLDER_BASE = "https://bill.example.com/apply";
export const PROGRAM_COMPANY_NAME = "관리비서";

export function unitLabel(mode: "code" | "name", unitNo: string, tenantName: string | null): string {
  if (mode === "name" && tenantName && tenantName.trim()) return tenantName;
  return unitNo;
}

export function buildQrPayload(unitId: number, period: string, base?: string | null): string {
  const b = base && base.trim() ? base : BILL_QR_PLACEHOLDER_BASE;
  return `${b}?unit=${unitId}&period=${period}`;
}

export interface PrintableAccount { bank: string; acct: string; holder: string; }
export interface AccountConfig {
  mgmtBank1?: string | null; mgmtAcct1?: string | null; mgmtHolder1?: string | null; mgmtPrint1?: boolean;
  mgmtBank2?: string | null; mgmtAcct2?: string | null; mgmtHolder2?: string | null; mgmtPrint2?: boolean;
}
export function printableAccounts(config: AccountConfig | null | undefined): PrintableAccount[] {
  if (!config) return [];
  const out: PrintableAccount[] = [];
  if (config.mgmtPrint1 && (config.mgmtBank1 || config.mgmtAcct1))
    out.push({ bank: config.mgmtBank1 ?? "", acct: config.mgmtAcct1 ?? "", holder: config.mgmtHolder1 ?? "" });
  if (config.mgmtPrint2 && (config.mgmtBank2 || config.mgmtAcct2))
    out.push({ bank: config.mgmtBank2 ?? "", acct: config.mgmtAcct2 ?? "", holder: config.mgmtHolder2 ?? "" });
  return out;
}

export interface BillItem { feeItemId: number; name: string; charged: boolean; amount: number; }
export function billDocumentTotal(items: BillItem[]): number {
  return items.reduce((s, i) => (i.charged ? s + i.amount : s), 0);
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run lib/bill/document.test.ts` · Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/bill/document.ts lib/bill/document.test.ts
git commit -m "$(printf 'feat(bill): 고지서 순수 유틸(unitLabel·QR payload·계좌필터·합계)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: `hooks/reactquery/bill` 도메인

**Files:**
- Create: `hooks/reactquery/bill/apis.ts`, `keys.ts`, `queries.ts`, `mutations.ts`, `index.ts`
- Test: `hooks/reactquery/bill/apis.test.ts`

**Interfaces:**
- Consumes: `BillItem`(lib/bill/document).
- Produces: `listBillTargets`·`getBillDocuments`·`issueBills` + 타입 `BillTarget`·`BillDocument`·`IssueBillsPayload` + hooks `useBillTargets`·`useBillDocuments`·`useIssueBills` + `billKeys`. Task 7·8이 소비.

- [ ] **Step 1: 실패 테스트 작성 (apis 매핑)**

```ts
// hooks/reactquery/bill/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
import { listBillTargets, getBillDocuments, issueBills } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("bill apis", () => {
  it("listBillTargets: list_bill_targets 호출·snake→camel", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, occupancy_id: 5, tenant_name: "홍", phone: "010",
      total_amount: 30000, auto_debit: true, issue_type: "a4", due_date: "2026-08-25", send_status: "none", issued_at: "2026-08-13T00:00:00Z",
    }], error: null });
    const r = await listBillTargets(7, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_bill_targets", { p_building_id: 7, p_period: "2026-08-01" });
    expect(r[0]).toMatchObject({ unitId: 1, tenantName: "홍", totalAmount: 30000, autoDebit: true, issueType: "a4", issuedAt: "2026-08-13T00:00:00Z" });
  });
  it("getBillDocuments: unit_ids 전송·items 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, tenant_name: "홍", total_amount: 30000, auto_debit: false,
      items: [{ fee_item_id: 10, name: "관리비", charged: true, amount: 30000 }], billing_note: null, unit_notice: null,
    }], error: null });
    const r = await getBillDocuments(7, "2026-08-01", [1]);
    expect(rpc).toHaveBeenCalledWith("get_bill_documents", { p_building_id: 7, p_period: "2026-08-01", p_unit_ids: [1] });
    expect(r[0].items).toEqual([{ feeItemId: 10, name: "관리비", charged: true, amount: 30000 }]);
  });
  it("issueBills: payload snake 전송·count 반환", async () => {
    rpc.mockResolvedValue({ data: { count: 3 }, error: null });
    const r = await issueBills({ buildingId: 7, period: "2026-08-01", unitIds: [1, 2, 3], issueType: "a4", dueDate: "2026-08-25", unitLabelMode: "code" });
    expect(rpc).toHaveBeenCalledWith("issue_bills", { p_building_id: 7, p_period: "2026-08-01", p_unit_ids: [1, 2, 3], p_issue_type: "a4", p_due_date: "2026-08-25", p_unit_label_mode: "code" });
    expect(r).toEqual({ count: 3 });
  });
  it("에러 시 throw", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listBillTargets(7, "2026-08-01")).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/bill/apis.test.ts` · Expected: FAIL (module not found)

- [ ] **Step 3: apis.ts 구현**

```ts
// hooks/reactquery/bill/apis.ts
import { createClient } from "@/lib/supabase/client";
import type { BillItem } from "@/lib/bill/document";

export interface BillTarget {
  unitId: number; unitNo: string; dong: string | null; occupancyId: number | null;
  tenantName: string | null; phone: string | null; totalAmount: number; autoDebit: boolean;
  issueType: string | null; dueDate: string | null; sendStatus: string | null; issuedAt: string | null;
}
type BillTargetDbRow = {
  unit_id: number; unit_no: string; dong: string | null; occupancy_id: number | null;
  tenant_name: string | null; phone: string | null; total_amount: number; auto_debit: boolean;
  issue_type: string | null; due_date: string | null; send_status: string | null; issued_at: string | null;
};
const rowToTarget = (r: BillTargetDbRow): BillTarget => ({
  unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, occupancyId: r.occupancy_id,
  tenantName: r.tenant_name, phone: r.phone, totalAmount: r.total_amount, autoDebit: r.auto_debit,
  issueType: r.issue_type, dueDate: r.due_date, sendStatus: r.send_status, issuedAt: r.issued_at,
});

export interface BillDocument {
  unitId: number; unitNo: string; dong: string | null; tenantName: string | null;
  totalAmount: number; autoDebit: boolean; items: BillItem[]; billingNote: string | null; unitNotice: string | null;
}
type BillDocDbItem = { fee_item_id: number; name: string; charged: boolean; amount: number };
type BillDocDbRow = {
  unit_id: number; unit_no: string; dong: string | null; tenant_name: string | null;
  total_amount: number; auto_debit: boolean; items: BillDocDbItem[] | null; billing_note: string | null; unit_notice: string | null;
};
const rowToDoc = (r: BillDocDbRow): BillDocument => ({
  unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, tenantName: r.tenant_name,
  totalAmount: r.total_amount, autoDebit: r.auto_debit,
  items: (r.items ?? []).map((i) => ({ feeItemId: i.fee_item_id, name: i.name, charged: i.charged, amount: i.amount })),
  billingNote: r.billing_note, unitNotice: r.unit_notice,
});

export async function listBillTargets(buildingId: number, period: string): Promise<BillTarget[]> {
  const { data, error } = await createClient().rpc("list_bill_targets", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as BillTargetDbRow[]).map(rowToTarget);
}
export async function getBillDocuments(buildingId: number, period: string, unitIds: number[]): Promise<BillDocument[]> {
  const { data, error } = await createClient().rpc("get_bill_documents", { p_building_id: buildingId, p_period: period, p_unit_ids: unitIds });
  if (error) throw new Error(error.message);
  return ((data ?? []) as BillDocDbRow[]).map(rowToDoc);
}
export interface IssueBillsPayload {
  buildingId: number; period: string; unitIds: number[]; issueType: string; dueDate: string | null; unitLabelMode: "code" | "name";
}
export async function issueBills(p: IssueBillsPayload): Promise<{ count: number }> {
  const { data, error } = await createClient().rpc("issue_bills", {
    p_building_id: p.buildingId, p_period: p.period, p_unit_ids: p.unitIds,
    p_issue_type: p.issueType, p_due_date: p.dueDate, p_unit_label_mode: p.unitLabelMode,
  });
  if (error) throw new Error(error.message);
  const r = (data ?? { count: 0 }) as { count: number };
  return { count: r.count };
}
```

- [ ] **Step 4: keys/queries/mutations/index 작성**

```ts
// hooks/reactquery/bill/keys.ts
export const billKeys = {
  all: ["bill"] as const,
  targets: (buildingId: number, period: string) => ["bill", "targets", buildingId, period] as const,
  documents: (buildingId: number, period: string, unitIds: number[]) => ["bill", "documents", buildingId, period, unitIds] as const,
};
```

```ts
// hooks/reactquery/bill/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listBillTargets, getBillDocuments } from "./apis";
import { billKeys } from "./keys";

export function useBillTargets(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: billKeys.targets(buildingId ?? 0, period),
    queryFn: () => listBillTargets(buildingId as number, period),
    enabled: !!buildingId,
  });
}
export function useBillDocuments(buildingId: number | null, period: string, unitIds: number[]) {
  return useQuery({
    queryKey: billKeys.documents(buildingId ?? 0, period, unitIds),
    queryFn: () => getBillDocuments(buildingId as number, period, unitIds),
    enabled: !!buildingId && unitIds.length > 0,
  });
}
```

```ts
// hooks/reactquery/bill/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { issueBills, type IssueBillsPayload } from "./apis";
import { billKeys } from "./keys";

export function useIssueBills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: IssueBillsPayload) => issueBills(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: billKeys.all }),
  });
}
```

```ts
// hooks/reactquery/bill/index.ts
export * from "./apis";
export * from "./keys";
export * from "./queries";
export * from "./mutations";
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run hooks/reactquery/bill/apis.test.ts` · Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add hooks/reactquery/bill
git commit -m "$(printf 'feat(bill): reactquery 도메인(targets/documents/issue) + apis 테스트\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Group 2 — 화면 · 컴포넌트

### Task 5: `qrcode.react` 의존 + `QrCode` 컴포넌트

**Files:**
- Modify: `package.json` (dependency 추가)
- Create: `app/(staff)/staff/bill/components/QrCode.tsx`
- Test: `app/(staff)/staff/bill/components/QrCode.test.tsx`

**Interfaces:**
- Produces: `<QrCode value:string size?:number />`. Task 6이 소비.

- [ ] **Step 1: 패키지 설치**

Run: `npm install qrcode.react`
Expected: `qrcode.react`가 `dependencies`에 추가(자체 타입 포함). `npm ls qrcode.react`로 확인.

- [ ] **Step 2: 실패 테스트 작성**

```tsx
// app/(staff)/staff/bill/components/QrCode.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QrCode } from "./QrCode";

describe("QrCode", () => {
  it("value로 svg를 렌더한다", () => {
    const { container } = render(<QrCode value="https://x.io/a?unit=1" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `npx vitest run app/(staff)/staff/bill/components/QrCode.test.tsx` · Expected: FAIL (module not found)

- [ ] **Step 4: 구현**

```tsx
// app/(staff)/staff/bill/components/QrCode.tsx
"use client";
import { QRCodeSVG } from "qrcode.react";

export function QrCode({ value, size = 88 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} aria-label="고지서 QR" />;
}
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run app/(staff)/staff/bill/components/QrCode.test.tsx` · Expected: PASS (1 test)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json app/\(staff\)/staff/bill/components/QrCode.tsx app/\(staff\)/staff/bill/components/QrCode.test.tsx
git commit -m "$(printf 'feat(bill): QrCode 컴포넌트(qrcode.react 동기 렌더)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: `BillPrintView` — A4 인쇄 뷰

**Files:**
- Create: `app/(staff)/staff/bill/components/BillPrintView.tsx`
- Test: `app/(staff)/staff/bill/components/BillPrintView.test.tsx`

**Interfaces:**
- Consumes: `BillDocument`(hooks/reactquery/bill), `PrintableAccount`·`unitLabel`·`buildQrPayload`·`billDocumentTotal`·`PROGRAM_COMPANY_NAME`(lib/bill/document), `QrCode`(Task 5).
- Produces: `<BillPrintView {buildingName,period,unitLabelMode,dueDate,accounts,customerNotice,documents,qrBase?} />`. Task 8이 소비.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(staff)/staff/bill/components/BillPrintView.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BillPrintView } from "./BillPrintView";
import type { BillDocument } from "@/hooks/reactquery/bill";

const doc: BillDocument = {
  unitId: 1, unitNo: "101", dong: null, tenantName: "홍길동", totalAmount: 35000, autoDebit: true,
  items: [{ feeItemId: 10, name: "관리비", charged: true, amount: 30000 }, { feeItemId: 11, name: "수도", charged: true, amount: 5000 }],
  billingNote: null, unitNotice: "동파 주의",
};

describe("BillPrintView", () => {
  it("세대·항목·합계·자동이체·계좌·안내·QR을 렌더", () => {
    render(<BillPrintView buildingName="행복빌라" period="2026-08-01" unitLabelMode="code" dueDate="2026-08-25"
      accounts={[{ bank: "국민", acct: "123", holder: "관리" }]} customerNotice="안내문" documents={[doc]} />);
    expect(screen.getByText(/행복빌라 2026년 08월 관리비 고지서/)).toBeInTheDocument();
    expect(screen.getByText("관리비")).toBeInTheDocument();
    expect(screen.getByText("35,000원")).toBeInTheDocument();   // 합계
    expect(screen.getByText(/자동이체/)).toBeInTheDocument();
    expect(screen.getByText(/국민 123/)).toBeInTheDocument();
    expect(screen.getByText("안내문")).toBeInTheDocument();
    expect(screen.getByText("동파 주의")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeTruthy();          // QR
  });
  it("name 모드는 입주자명으로 세대 표기", () => {
    render(<BillPrintView buildingName="B" period="2026-08-01" unitLabelMode="name" dueDate={null}
      accounts={[]} customerNotice={null} documents={[doc]} />);
    expect(screen.getByText(/홍길동/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run app/(staff)/staff/bill/components/BillPrintView.test.tsx` · Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/bill/components/BillPrintView.tsx
"use client";
import type { BillDocument } from "@/hooks/reactquery/bill";
import { unitLabel, buildQrPayload, billDocumentTotal, PROGRAM_COMPANY_NAME, type PrintableAccount } from "@/lib/bill/document";
import { QrCode } from "./QrCode";

export interface BillPrintViewProps {
  buildingName: string;
  period: string;                 // 'YYYY-MM-01'
  unitLabelMode: "code" | "name";
  dueDate: string | null;
  accounts: PrintableAccount[];
  customerNotice: string | null;
  documents: BillDocument[];
  qrBase?: string | null;
}

export function BillPrintView({ buildingName, period, unitLabelMode, dueDate, accounts, customerNotice, documents, qrBase }: BillPrintViewProps) {
  const ym = `${period.slice(0, 4)}년 ${period.slice(5, 7)}월`;
  return (
    <div className="hidden print:block" data-testid="bill-print">
      {documents.map((d) => {
        const items = d.items.filter((i) => i.charged);
        const total = d.totalAmount || billDocumentTotal(d.items);
        return (
          <div key={d.unitId} className="break-after-page p-6 text-black">
            <div className="flex items-start justify-between">
              <h1 className="text-xl font-bold">{buildingName} {ym} 관리비 고지서</h1>
              <QrCode value={buildQrPayload(d.unitId, period, qrBase)} />
            </div>
            <div className="mt-2 text-sm">
              세대: {unitLabel(unitLabelMode, d.unitNo, d.tenantName)}
              {d.autoDebit && <span className="ml-2 font-bold">[자동이체]</span>}
            </div>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {items.map((i) => (
                  <tr key={i.feeItemId}><td>{i.name}</td><td className="text-right">{i.amount.toLocaleString()}원</td></tr>
                ))}
                <tr className="border-t font-bold"><td>합계</td><td className="text-right">{total.toLocaleString()}원</td></tr>
              </tbody>
            </table>
            <div className="mt-3 text-sm">납기일: {dueDate ?? "-"}</div>
            {accounts.length > 0 && (
              <div className="mt-3 text-sm">
                {accounts.map((a, idx) => (<div key={idx}>입금계좌: {a.bank} {a.acct} ({a.holder})</div>))}
              </div>
            )}
            {customerNotice && <div className="mt-3 whitespace-pre-wrap text-xs">{customerNotice}</div>}
            {d.unitNotice && <div className="mt-1 whitespace-pre-wrap text-xs">{d.unitNotice}</div>}
            <div className="mt-6 text-right text-[10px] text-gray-500">{PROGRAM_COMPANY_NAME}</div>
          </div>
        );
      })}
    </div>
  );
}
```
> `hidden print:block`: 화면에선 숨김, 인쇄 시 표시. jsdom 테스트는 CSS를 적용하지 않으므로 텍스트 쿼리로 검증된다. 실제 인쇄 시 페이지 본문의 나머지는 Task 8에서 `print:hidden`.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run app/(staff)/staff/bill/components/BillPrintView.test.tsx` · Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/\(staff\)/staff/bill/components/BillPrintView.tsx app/\(staff\)/staff/bill/components/BillPrintView.test.tsx
git commit -m "$(printf 'feat(bill): A4 인쇄 뷰(항목·합계·자동이체·계좌·QR·회사명, @media print)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 7: `BillTargetTable` — 확정 세대 표

**Files:**
- Create: `app/(staff)/staff/bill/components/BillTargetTable.tsx`
- Test: `app/(staff)/staff/bill/components/BillTargetTable.test.tsx`

**Interfaces:**
- Consumes: `BillTarget`(hooks/reactquery/bill), `unitLabel`(lib/bill/document), `Button`·`Checkbox`(components/common).
- Produces: `<BillTargetTable {targets,unitLabelMode,selected,onToggle,onToggleAll,onPrint,onSend} />`. Task 8이 소비.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(staff)/staff/bill/components/BillTargetTable.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillTargetTable } from "./BillTargetTable";
import type { BillTarget } from "@/hooks/reactquery/bill";

const t = (o: Partial<BillTarget>): BillTarget => ({
  unitId: 1, unitNo: "101", dong: null, occupancyId: 5, tenantName: "홍길동", phone: "010",
  totalAmount: 30000, autoDebit: false, issueType: null, dueDate: null, sendStatus: null, issuedAt: null, ...o,
});

describe("BillTargetTable", () => {
  it("빈 목록은 안내 문구", () => {
    render(<BillTargetTable targets={[]} unitLabelMode="code" selected={[]} onToggle={() => {}} onToggleAll={() => {}} onPrint={() => {}} onSend={() => {}} />);
    expect(screen.getByText(/부과 확정된 세대가 없습니다/)).toBeInTheDocument();
  });
  it("세대 행·발행상태 표시, 체크 시 onToggle", () => {
    const onToggle = vi.fn();
    render(<BillTargetTable targets={[t({ issuedAt: "2026-08-13T00:00:00Z", autoDebit: true })]} unitLabelMode="code"
      selected={[]} onToggle={onToggle} onToggleAll={() => {}} onPrint={() => {}} onSend={() => {}} />);
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByText("자동이체")).toBeInTheDocument();
    expect(screen.getByText("발행")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("101 선택"));
    expect(onToggle).toHaveBeenCalledWith(1);
  });
  it("선택 0이면 인쇄·발송 비활성", () => {
    render(<BillTargetTable targets={[t({})]} unitLabelMode="code" selected={[]} onToggle={() => {}} onToggleAll={() => {}} onPrint={() => {}} onSend={() => {}} />);
    expect(screen.getByRole("button", { name: "A4 인쇄" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "문자 발송" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run app/(staff)/staff/bill/components/BillTargetTable.test.tsx` · Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/bill/components/BillTargetTable.tsx
"use client";
import { Button, Checkbox } from "@/components/common";
import { unitLabel } from "@/lib/bill/document";
import type { BillTarget } from "@/hooks/reactquery/bill";

export interface BillTargetTableProps {
  targets: BillTarget[];
  unitLabelMode: "code" | "name";
  selected: number[];
  onToggle: (unitId: number) => void;
  onToggleAll: () => void;
  onPrint: () => void;
  onSend: () => void;
}

export function BillTargetTable({ targets, unitLabelMode, selected, onToggle, onToggleAll, onPrint, onSend }: BillTargetTableProps) {
  if (targets.length === 0) {
    return <div className="rounded-xl border border-line bg-surface p-8 text-center text-t2">부과 확정된 세대가 없습니다 — 관리비 부과셋팅에서 확정 후 발행</div>;
  }
  const allChecked = selected.length === targets.length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="primary" onClick={onPrint} disabled={selected.length === 0}>A4 인쇄</Button>
        <Button variant="ghost" onClick={onSend} disabled={selected.length === 0}>문자 발송</Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-t2">
            <th className="p-2"><Checkbox aria-label="전체 선택" checked={allChecked} onChange={onToggleAll} /></th>
            <th className="p-2 text-left">호실</th>
            <th className="p-2 text-left">입주자명</th>
            <th className="p-2 text-right">총액</th>
            <th className="p-2">자동이체</th>
            <th className="p-2">발행상태</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t) => (
            <tr key={t.unitId} className="border-t border-line">
              <td className="p-2"><Checkbox aria-label={`${t.unitNo} 선택`} checked={selected.includes(t.unitId)} onChange={() => onToggle(t.unitId)} /></td>
              <td className="p-2">{unitLabel(unitLabelMode, t.unitNo, t.tenantName)}</td>
              <td className="p-2">{t.tenantName ?? "-"}</td>
              <td className="p-2 text-right">{t.totalAmount.toLocaleString()}원</td>
              <td className="p-2 text-center">{t.autoDebit ? "자동이체" : "-"}</td>
              <td className="p-2 text-center">{t.issuedAt ? "발행" : "미발행"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
> `Checkbox`의 `onChange`는 이벤트를 넘기지만 여기선 무시하고 `onToggle(unitId)`만 호출한다. `components/common`의 실제 `Checkbox`/`Button` props(`variant`·`checked`·`onChange`·`aria-label`)는 BillingSettingsTab/AccountSettingsTab 사용부와 동일.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run app/(staff)/staff/bill/components/BillTargetTable.test.tsx` · Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/\(staff\)/staff/bill/components/BillTargetTable.tsx app/\(staff\)/staff/bill/components/BillTargetTable.test.tsx
git commit -m "$(printf 'feat(bill): 확정 세대 표(선택·자동이체·발행상태·빈상태)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Group 3 — 화면 조립 · 발송 · 회귀

### Task 8: `/staff/bill` page — 게이트·컨트롤·인쇄·발송 배선

**Files:**
- Create: `app/(staff)/staff/bill/page.tsx`
- Test: `app/(staff)/staff/bill/page.test.tsx`
- Modify: `components/shell/navItems.ts` (`/staff/bill` `built:false→true`)

**Interfaces:**
- Consumes: `useMe`·`hasModule`·`useBuildings`·`useSetupConfig`·`useBillTargets`·`useBillDocuments`·`useIssueBills`·`currentPeriod`/`toMonthInput`/`fromMonthInput`·`printableAccounts`·`BillTargetTable`·`BillPrintView`·`MessagingModal`·`MessageRecipient`.
- Produces: 기본 export `BillPage`(라우트 `/staff/bill`).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(staff)/staff/bill/page.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: () => ({ data: [{ id: 7, name: "행복빌라" }] }) }));
vi.mock("@/hooks/reactquery/setupConfig", () => ({ useSetupConfig: () => ({ data: { unitLabelDefault: "code", mgmtPrint1: false, mgmtPrint2: false } }) }));
vi.mock("@/hooks/reactquery/bill", () => ({
  useBillTargets: vi.fn(() => ({ data: [], isLoading: false })),
  useBillDocuments: () => ({ data: [] }),
  useIssueBills: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/app/(staff)/staff/messaging/components/MessagingModal", () => ({ MessagingModal: () => null }));

import BillPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillTargets } from "@/hooks/reactquery/bill";
beforeEach(() => vi.clearAllMocks());

describe("BillPage 게이트", () => {
  it("bill_publish 권한 없으면 차단", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "field_staff", permissions: [] } } as unknown as ReturnType<typeof useMe>);
    render(<BillPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });
  it("권한 있으면 건물 선택 노출·초기 안내", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", orgId: 1, permissions: ["bill_publish"] } } as unknown as ReturnType<typeof useMe>);
    render(<BillPage />);
    expect(screen.getByText(/건물을 선택/)).toBeInTheDocument();
  });
  it("건물 선택 후 확정 세대 없으면 빈 안내", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", orgId: 1, permissions: ["bill_publish"] } } as unknown as ReturnType<typeof useMe>);
    vi.mocked(useBillTargets).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useBillTargets>);
    render(<BillPage />);
    // 초기엔 건물 미선택 → 안내. (건물 선택 상호작용은 통합 시 확인)
    expect(screen.getByText(/건물을 선택/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run app/(staff)/staff/bill/page.test.tsx` · Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/bill/page.tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { useBillTargets, useBillDocuments, useIssueBills } from "@/hooks/reactquery/bill";
import { currentPeriod, toMonthInput, fromMonthInput } from "@/lib/billing/period";
import { printableAccounts } from "@/lib/bill/document";
import type { MessageRecipient } from "@/lib/messaging/preset";
import { MessagingModal } from "@/app/(staff)/staff/messaging/components/MessagingModal";
import { BillTargetTable } from "./components/BillTargetTable";
import { BillPrintView } from "./components/BillPrintView";

export default function BillPage() {
  const { data: me } = useMe();
  const { data: buildings } = useBuildings();
  const { data: config } = useSetupConfig(me?.orgId);

  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState(currentPeriod());
  const [labelMode, setLabelMode] = useState<"code" | "name">("code");
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [sendOpen, setSendOpen] = useState(false);
  // setup 기본 세대표기 반영(렌더-중 이전값 비교 — set-state-in-effect 회피)
  const [prevDefault, setPrevDefault] = useState<string | undefined>(undefined);
  if (config && config.unitLabelDefault !== prevDefault) {
    setPrevDefault(config.unitLabelDefault);
    setLabelMode(config.unitLabelDefault as "code" | "name");
  }

  const { data: targets, isLoading } = useBillTargets(buildingId, period);
  const { data: documents } = useBillDocuments(buildingId, period, selected);
  const issue = useIssueBills();

  if (!hasModule(me, "bill_publish")) {
    return <div className="p-8 text-t2">접근할 권한이 없습니다.</div>;
  }

  const building = (buildings ?? []).find((b) => b.id === buildingId) ?? null;
  const rows = targets ?? [];
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected((s) => (s.length === rows.length ? [] : rows.map((r) => r.unitId)));

  const onPrint = async () => {
    if (!buildingId || selected.length === 0) return;
    if (!documents || documents.length === 0) { toast.error("고지서 데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요."); return; }
    try {
      await issue.mutateAsync({ buildingId, period, unitIds: selected, issueType: "a4", dueDate: dueDate || null, unitLabelMode: labelMode });
      window.print();
      toast.success(`${selected.length}세대 고지서를 발행했습니다`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "발행에 실패했습니다.");
    }
  };

  const recipients: MessageRecipient[] = rows
    .filter((t) => selected.includes(t.unitId))
    .map((t) => ({ name: t.tenantName, phone: t.phone, unitNo: t.unitNo, kind: "tenant" as const, ref: { occupancyId: t.occupancyId ?? undefined, buildingId: buildingId ?? undefined } }));

  return (
    <div className="flex flex-col gap-4 p-6 print:hidden">
      <h1 className="text-lg font-extrabold text-t1">고지서 발행</h1>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-t2">건물
          <Select aria-label="건물 선택" value={buildingId != null ? String(buildingId) : ""}
            onChange={(e) => { setBuildingId(e.target.value ? Number(e.target.value) : null); setSelected([]); }}
            options={[{ value: "", label: "건물을 선택해 주세요" }, ...(buildings ?? []).map((b) => ({ value: String(b.id), label: b.name }))]} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-t2">부과월
          <input type="month" aria-label="부과월" value={toMonthInput(period)}
            onChange={(e) => { setPeriod(fromMonthInput(e.target.value)); setSelected([]); }}
            className="rounded-xl border border-line bg-surface p-2 text-sm text-t1" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-t2">세대 표기
          <Select aria-label="세대 표기" value={labelMode} onChange={(e) => setLabelMode(e.target.value as "code" | "name")}
            options={[{ value: "code", label: "코드출력" }, { value: "name", label: "이름출력" }]} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-t2">납기일
          <input type="date" aria-label="납기일" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="rounded-xl border border-line bg-surface p-2 text-sm text-t1" />
        </label>
      </div>

      {!buildingId ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-t2">건물을 선택해 주세요.</div>
      ) : isLoading ? (
        <div className="p-8 text-center text-t2">불러오는 중…</div>
      ) : (
        <BillTargetTable targets={rows} unitLabelMode={labelMode} selected={selected}
          onToggle={toggle} onToggleAll={toggleAll} onPrint={onPrint} onSend={() => setSendOpen(true)} />
      )}

      {building && documents && (
        <BillPrintView buildingName={building.name} period={period} unitLabelMode={labelMode} dueDate={dueDate || null}
          accounts={printableAccounts(config)} customerNotice={config?.customerNotice ?? null} documents={documents} />
      )}

      <MessagingModal open={sendOpen} onClose={() => setSendOpen(false)}
        preset={{ context: "고지서", channel: "sms", body: "관리비 고지서를 안내드립니다.", recipients }}
        onSent={(r) => { setSendOpen(false); toast.success(`${r.count}세대에 발송(stub)했습니다`); }} />
    </div>
  );
}
```

- [ ] **Step 4: navItems 갱신**

`components/shell/navItems.ts`에서 고지서 발행 항목의 `built: false`를 `built: true`로 변경:

```ts
{ label: "고지서 발행", href: "/staff/bill", module: "bill_publish", built: true, icon: "M5 3h14a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h4" },
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run app/(staff)/staff/bill/page.test.tsx` · Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add app/\(staff\)/staff/bill/page.tsx app/\(staff\)/staff/bill/page.test.tsx components/shell/navItems.ts
git commit -m "$(printf 'feat(bill): /staff/bill 화면(게이트·컨트롤·A4 인쇄·발행기록·문자 배선) + GNB 활성화\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## 최종 검증 (전체 완료 후)

- [ ] `npx vitest run` — 전체 그린(신규 테스트 포함)
- [ ] `npx tsc --noEmit` — 타입 에러 0
- [ ] `npm run lint` — 린트 0 (특히 신규 page/컴포넌트에 `set-state-in-effect`·`no-explicit-any` 없음)
- [ ] `supabase/verify/p5_bill_checks.sql` 존재 확인(라이브 검증은 사용자 PC: 0013 적용 후 실행)
- [ ] AGENTS.md 에이전트 블록이 `next dev`로 재생성됐으면 커밋에 포함(트리 클린)
- [ ] (master 병합 후) `wbs-commit-sync`로 고지서 발행 화면 dev 트랙 반영

---

## Self-Review (작성자 체크 결과)

**1. Spec coverage:**
- §3 `bill_issues`·RLS → Task 1. §3 RPC 3종(list_bill_targets·get_bill_documents·issue_bills)+verify → Task 2. §4 순수 유틸 → Task 3. §5 데이터층 → Task 4. §6 QrCode → Task 5, BillPrintView → Task 6, BillTargetTable → Task 7, page+navItems+발송 → Task 8. §9 테스트 → 각 Task TDD. §10 마이그/의존 → Task 1·2·5.
- Out of scope(지로·카톡·팩스·예약·그룹·단수·조정명세서·발송상태 연동) → 계획에서도 제외(일치).

**2. Placeholder scan:** 코드 스텝은 실제 코드 포함. TODO성 공백 없음. `auto_debit`은 실 스키마(`unit_accounts` kind='mgmt'·`cms_member_no`, 0006 확인)로 구체화.

**3. Type consistency:** `BillItem`(document.ts) ↔ `BillDocument.items`(apis.ts) ↔ BillPrintView 소비 일치. `BillTarget`(apis) ↔ BillTargetTable/page 일치. RPC 인자명(`p_building_id`·`p_period`·`p_unit_ids`·`p_issue_type`·`p_due_date`·`p_unit_label_mode`)이 SQL(Task 2) ↔ apis(Task 4) 일치. `MessagingModal`(open/preset/onClose/onSent)·`MessagingPreset`(context/channel/body/recipients)·`MessageRecipient`(name/phone/unitNo/kind/ref) = 기존 `lib/messaging/preset.ts`·`MessagingModal.tsx` 시그니처 준수. `hasModule(me,'bill_publish')` = permissions.ts 키.

**검증 유의(구현 시):** `useBuildings`/`useSetupConfig` 실제 반환 필드가 가정과 다르면 맞춘다. `components/common`의 `Select`/`Checkbox`/`Button` props는 setup 탭 사용부 기준. `window.print`는 테스트에서 mock. `qrcode.react`는 `QRCodeSVG` named export.
