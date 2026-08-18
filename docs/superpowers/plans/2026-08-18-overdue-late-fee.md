# 연체료(단계별 차등·월분별 누적) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미납 관리 화면(`/staff/overdue`)에 연체료(단계별 차등 요율·월분별 누적)를 계산·표시하고, org 단위 요율표를 화면 내에서 관리한다.

**Architecture:** 신규 RPC `list_overdue_periods`가 세대×월분별 미납원금·납기일을 반환하고, 순수함수 `lib/billing/lateFee.ts`가 org 요율표로 연체료를 실시간 계산한다. 요율표는 신규 테이블 `late_fee_rate_tiers`(org 단위) + react-query CRUD 훅으로 관리한다. UI 변경은 `/staff/overdue` 도메인 내부(표 컬럼·합계행·상세모달·요율 모달·CSV)로 한정한다.

**Tech Stack:** Next.js App Router, Supabase(Postgres RPC/RLS), @tanstack/react-query, vitest + Testing Library, TypeScript.

## Global Constraints

- **ID 타입은 모두 `bigint`** (generated always as identity). uuid 아님. org_id·building_id·occupancy_id·unit_id 전부 bigint.
- **마이그 번호 = `0026`**. 커밋 직전 `git fetch origin && ls supabase/migrations`로 `origin/master` 최대 번호 재확인(현재 0025까지). 충돌 시 재번호.
- **겹침 회피 — 다음 파일은 수정 금지:** `app/(staff)/staff/setup/**`, `components/forms/schema/setup.ts`, `app/(staff)/staff/bill/**`, `app/(staff)/staff/payment/**`, `app/(staff)/staff/messaging/**`, `app/(staff)/staff/management-fee/**`.
- **연체료 반올림 = 원 단위** `Math.round`.
- **요율표 RLS:** 읽기 `org_id = current_user_org()`, 쓰기 추가로 `current_user_has_module('billing')` (0024 패턴).
- **기존 패턴 준수:** supabase는 `createClient()`(from `@/lib/supabase/client` — 기존 apis import 경로 그대로), 금액 포맷 `formatWon`, 공용 모달 `@/components/common/Modal`, 권한 `hasModule(me, "billing")`, react-query 키/훅 컨벤션.
- **검증:** `npx tsc --noEmit` 0, `npm run lint` 0, `npx vitest run` green.
- **AGENTS.md 블록:** `next dev`가 재작성하는 블록이 diff에 뜨면 그대로 커밋(트리 청결 유지).

---

### Task 1: 마이그 0026 — 요율표 테이블 + RPC

**Files:**
- Create: `supabase/migrations/0026_overdue_late_fees.sql`
- Create: `supabase/tests/p8_overdue_late_fees_checks.sql` (수동 검증용)

**Interfaces:**
- Produces:
  - table `late_fee_rate_tiers(id bigint, org_id bigint, tier_order int, from_month int, to_month int null, monthly_rate numeric(6,4), created_at, updated_at)`
  - rpc `list_overdue_periods(p_building_id bigint, p_target_year int, p_target_month int, p_scope text) returns table(occupancy_id bigint, unit_id bigint, period date, unpaid_principal bigint, due_date date)`

- [ ] **Step 1: org FK 테이블명 확인**

Run: `grep -rn "references .*org" supabase/migrations/0002_p2a_accounts_permissions.sql supabase/migrations/0000_p0_auth_foundation.sql`
목적: org를 참조하는 정확한 테이블명 확인(예: `orgs` 또는 `organizations`). 이후 스텝의 `<ORGS>`를 실제 이름으로 치환.
또한 `grep -rn "current_user_org\|current_user_has_module\|my_org_ids" supabase/migrations/*.sql | head`로 RLS 헬퍼 함수 존재 확인.

- [ ] **Step 2: 마이그 파일 작성**

`supabase/migrations/0026_overdue_late_fees.sql`:

```sql
-- 0026_overdue_late_fees.sql
-- 연체료 요율표(org 단위) + 세대×월분별 미납/납기 조회 RPC
-- 의존: P1a(units, occupancies), buildings(org_id), P5(billing_confirmations),
--       P6(payments), 0024(billing_period_settings)

-- 1) 요율표 (org 단위, 연체개월 구간별 월요율)
create table if not exists late_fee_rate_tiers (
  id bigint generated always as identity primary key,
  org_id bigint not null references <ORGS>(id) on delete cascade,
  tier_order int not null,
  from_month int not null,          -- 구간 시작(연체 개월차, exclusive)
  to_month int,                     -- 구간 끝(연체 개월차, inclusive), null = 무한대
  monthly_rate numeric(6,4) not null, -- 월요율(%) 예: 1.2000
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_month >= 0),
  check (to_month is null or to_month > from_month),
  check (monthly_rate >= 0)
);

create index if not exists idx_late_fee_rate_tiers_org
  on late_fee_rate_tiers(org_id, tier_order);

alter table late_fee_rate_tiers enable row level security;

create policy lfrt_select on late_fee_rate_tiers
  for select using (org_id = current_user_org());

create policy lfrt_write on late_fee_rate_tiers
  for all
  using (org_id = current_user_org() and current_user_has_module('billing'))
  with check (org_id = current_user_org() and current_user_has_module('billing'));

-- 2) 기존 org에 기본 요율표 seed (0~1:1.0% / 1~3:1.2% / 3~:1.5%)
insert into late_fee_rate_tiers (org_id, tier_order, from_month, to_month, monthly_rate)
select o.id, v.tier_order, v.from_month, v.to_month, v.monthly_rate
from <ORGS> o
cross join (values
  (1, 0, 1, 1.0),
  (2, 1, 3, 1.2),
  (3, 3, null::int, 1.5)
) as v(tier_order, from_month, to_month, monthly_rate)
where not exists (
  select 1 from late_fee_rate_tiers t where t.org_id = o.id
);

-- 3) 세대×월분별 미납원금·납기일 (0022 period_balances를 그대로 노출)
create or replace function list_overdue_periods(
  p_building_id bigint,
  p_target_year int default extract(year from timezone('Asia/Seoul', now()))::int,
  p_target_month int default extract(month from timezone('Asia/Seoul', now()))::int,
  p_scope text default 'all'
)
returns table(
  occupancy_id bigint,
  unit_id bigint,
  period date,
  unpaid_principal bigint,
  due_date date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target_period date;
begin
  if p_target_year is null or p_target_year not between 1 and 9999 then
    raise exception 'target year must be between 1 and 9999';
  end if;
  if p_target_month is null or p_target_month not between 1 and 12 then
    raise exception 'target month must be between 1 and 12';
  end if;
  if p_scope is null or p_scope not in ('all', 'current') then
    raise exception 'scope must be all or current';
  end if;

  v_target_period := make_date(p_target_year, p_target_month, 1);

  return query
  with current_occupancies as (
    select o.id as occupancy_id, o.unit_id
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = current_user_org()
    where u.building_id = p_building_id
      and o.status = 'occupied'
      and o.deleted_at is null
  ),
  scoped_confirmations as (
    select bc.occupancy_id, bc.unit_id, bc.period, bc.total_amount
    from billing_confirmations bc
    join current_occupancies co
      on co.occupancy_id = bc.occupancy_id
     and co.unit_id = bc.unit_id
    where bc.confirmed_at is not null
      and (
        (p_scope = 'current' and bc.period = v_target_period)
        or (p_scope = 'all' and bc.period <= v_target_period)
      )
  ),
  period_balances as (
    select
      bc.occupancy_id,
      bc.unit_id,
      bc.period,
      greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint) as outstanding
    from scoped_confirmations bc
    left join payments p
      on p.occupancy_id = bc.occupancy_id
     and p.unit_id = bc.unit_id
     and p.period = bc.period
     and p.status = 'active'
    group by bc.occupancy_id, bc.unit_id, bc.period, bc.total_amount
  )
  select
    pb.occupancy_id,
    pb.unit_id,
    pb.period,
    pb.outstanding as unpaid_principal,
    coalesce(
      bps.due_date,
      (date_trunc('month', pb.period) + interval '1 month' - interval '1 day')::date
    ) as due_date
  from period_balances pb
  left join billing_period_settings bps
    on bps.building_id = p_building_id
   and bps.period = pb.period
  where pb.outstanding > 0
  order by pb.occupancy_id, pb.unit_id, pb.period;
end;
$$;

revoke execute on function list_overdue_periods(bigint, int, int, text) from public, anon;
grant execute on function list_overdue_periods(bigint, int, int, text) to authenticated;
```

**주의:** `<ORGS>`를 Step 1에서 확인한 실제 테이블명으로 치환. RLS 헬퍼(`current_user_org`, `current_user_has_module`)가 없으면 0022/0024에서 실제 이름 확인 후 맞출 것.

- [ ] **Step 3: 검증 스크립트 작성**

`supabase/tests/p8_overdue_late_fees_checks.sql`:

```sql
-- 수동 검증(사용자 PC에서 psql/Management API로 실행)
-- 1) 테이블 존재
select to_regclass('public.late_fee_rate_tiers') is not null as table_ok;
-- 2) seed 존재(org당 3구간)
select org_id, count(*) from late_fee_rate_tiers group by org_id;
-- 3) RPC 존재
select proname from pg_proc where proname = 'list_overdue_periods';
-- 4) RLS 정책 2개
select policyname from pg_policies where tablename = 'late_fee_rate_tiers';
```

- [ ] **Step 4: 마이그 문법 셀프 점검**

Run: `grep -n "<ORGS>" supabase/migrations/0026_overdue_late_fees.sql`
Expected: 출력 없음(모두 치환됨). 남아 있으면 치환.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0026_overdue_late_fees.sql supabase/tests/p8_overdue_late_fees_checks.sql
git commit -m "feat(overdue): 연체료 요율표 테이블·list_overdue_periods RPC (0026)"
```

라이브 적용은 사용자 PC에서 수행(Claude는 파일만 작성). 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 추가.

---

### Task 2: 연체료 계산 순수함수 `lib/billing/lateFee.ts`

**Files:**
- Create: `lib/billing/lateFee.ts`
- Test: `lib/billing/lateFee.test.ts`

**Interfaces:**
- Consumes: `Period` type from `@/lib/billing/period` (`'YYYY-MM-01'` 문자열)
- Produces:
  - `RateTier { fromMonth: number; toMonth: number | null; monthlyRate: number }`
  - `OverduePeriodInput { period: Period; unpaidPrincipal: number; dueDate: string }`
  - `LateFeePeriodResult { period: Period; months: number; cumulativeRatePct: number; lateFee: number }`
  - `LateFeeResult { totalLateFee: number; byPeriod: LateFeePeriodResult[] }`
  - `rateForMonth(tiers, k)`, `cumulativeRate(tiers, n)`, `monthsOverdue(dueDate, asOfYear, asOfMonth)`, `computeLateFeeForPeriod(input, tiers, asOfYear, asOfMonth)`, `computeLateFee(periods, tiers, asOfYear, asOfMonth)`

- [ ] **Step 1: Write the failing test**

`lib/billing/lateFee.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  rateForMonth,
  cumulativeRate,
  monthsOverdue,
  computeLateFeeForPeriod,
  computeLateFee,
  type RateTier,
} from "./lateFee";

const TIERS: RateTier[] = [
  { fromMonth: 0, toMonth: 1, monthlyRate: 1.0 },
  { fromMonth: 1, toMonth: 3, monthlyRate: 1.2 },
  { fromMonth: 3, toMonth: null, monthlyRate: 1.5 },
];

describe("billing/lateFee", () => {
  it("rateForMonth: from exclusive · to inclusive · null 상한", () => {
    expect(rateForMonth(TIERS, 1)).toBe(1.0);
    expect(rateForMonth(TIERS, 2)).toBe(1.2);
    expect(rateForMonth(TIERS, 3)).toBe(1.2);
    expect(rateForMonth(TIERS, 4)).toBe(1.5);
    expect(rateForMonth(TIERS, 0)).toBe(0);
    expect(rateForMonth([], 5)).toBe(0);
  });

  it("cumulativeRate: 누적 요율 합", () => {
    expect(cumulativeRate(TIERS, 0)).toBe(0);
    expect(cumulativeRate(TIERS, 1)).toBeCloseTo(1.0);
    expect(cumulativeRate(TIERS, 3)).toBeCloseTo(3.4); // 1.0 + 1.2 + 1.2
  });

  it("monthsOverdue: 월 단위 차이, 음수/동월은 0", () => {
    expect(monthsOverdue("2026-03-31", 2026, 6)).toBe(3);
    expect(monthsOverdue("2026-06-30", 2026, 6)).toBe(0);
    expect(monthsOverdue("2026-08-31", 2026, 6)).toBe(0);
    expect(monthsOverdue("2025-12-31", 2026, 2)).toBe(2);
  });

  it("computeLateFeeForPeriod: 예시 3,400원", () => {
    const r = computeLateFeeForPeriod(
      { period: "2026-03-01", unpaidPrincipal: 100_000, dueDate: "2026-03-31" },
      TIERS,
      2026,
      6,
    );
    expect(r.months).toBe(3);
    expect(r.cumulativeRatePct).toBeCloseTo(3.4);
    expect(r.lateFee).toBe(3_400);
  });

  it("computeLateFee: 다중 period 합산 + 빈 요율표는 0", () => {
    const periods = [
      { period: "2026-03-01", unpaidPrincipal: 100_000, dueDate: "2026-03-31" },
      { period: "2026-05-01", unpaidPrincipal: 50_000, dueDate: "2026-05-31" },
    ];
    const total = computeLateFee(periods, TIERS, 2026, 6);
    // 03: 3개월 → 3.4% → 3400 / 05: 1개월 → 1.0% → 500
    expect(total.totalLateFee).toBe(3_900);
    expect(total.byPeriod).toHaveLength(2);
    expect(computeLateFee(periods, [], 2026, 6).totalLateFee).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/billing/lateFee.test.ts`
Expected: FAIL — `./lateFee` 모듈 없음.

- [ ] **Step 3: Write implementation**

`lib/billing/lateFee.ts`:

```typescript
import type { Period } from "@/lib/billing/period";

export interface RateTier {
  fromMonth: number; // 구간 시작(연체 개월차, exclusive)
  toMonth: number | null; // 구간 끝(inclusive), null = 무한대
  monthlyRate: number; // 월요율(%)
}

export interface OverduePeriodInput {
  period: Period;
  unpaidPrincipal: number;
  dueDate: string; // 'YYYY-MM-DD'
}

export interface LateFeePeriodResult {
  period: Period;
  months: number;
  cumulativeRatePct: number;
  lateFee: number;
}

export interface LateFeeResult {
  totalLateFee: number;
  byPeriod: LateFeePeriodResult[];
}

/** 연체 k개월차(k>=1)에 적용할 월요율(%). from < k <= to (to null=무한). 없으면 0. */
export function rateForMonth(tiers: RateTier[], k: number): number {
  if (k <= 0) return 0;
  for (const t of tiers) {
    const afterFrom = k > t.fromMonth;
    const beforeTo = t.toMonth === null || k <= t.toMonth;
    if (afterFrom && beforeTo) return t.monthlyRate;
  }
  return 0;
}

/** 연체 n개월 누적 요율(%) = Σ_{k=1..n} rateForMonth(k). */
export function cumulativeRate(tiers: RateTier[], n: number): number {
  let sum = 0;
  for (let k = 1; k <= n; k += 1) sum += rateForMonth(tiers, k);
  return sum;
}

/** 납기일부터 기준월(asOf) 말까지의 연체 개월수(월 단위, 음수→0). */
export function monthsOverdue(
  dueDate: string,
  asOfYear: number,
  asOfMonth: number,
): number {
  const [dy, dm] = dueDate.split("-").map(Number);
  const diff = (asOfYear - dy) * 12 + (asOfMonth - dm);
  return diff > 0 ? diff : 0;
}

export function computeLateFeeForPeriod(
  input: OverduePeriodInput,
  tiers: RateTier[],
  asOfYear: number,
  asOfMonth: number,
): LateFeePeriodResult {
  const months = monthsOverdue(input.dueDate, asOfYear, asOfMonth);
  const cumulativeRatePct = cumulativeRate(tiers, months);
  const lateFee = Math.round((input.unpaidPrincipal * cumulativeRatePct) / 100);
  return { period: input.period, months, cumulativeRatePct, lateFee };
}

export function computeLateFee(
  periods: OverduePeriodInput[],
  tiers: RateTier[],
  asOfYear: number,
  asOfMonth: number,
): LateFeeResult {
  const byPeriod = periods.map((p) =>
    computeLateFeeForPeriod(p, tiers, asOfYear, asOfMonth),
  );
  const totalLateFee = byPeriod.reduce((s, r) => s + r.lateFee, 0);
  return { totalLateFee, byPeriod };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/billing/lateFee.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/billing/lateFee.ts lib/billing/lateFee.test.ts
git commit -m "feat(overdue): 연체료 계산 순수함수 lateFee"
```

---

### Task 3: 요율표 CRUD 훅 `hooks/reactquery/lateFeeTiers/`

**Files:**
- Create: `hooks/reactquery/lateFeeTiers/apis.ts`
- Create: `hooks/reactquery/lateFeeTiers/keys.ts`
- Create: `hooks/reactquery/lateFeeTiers/queries.ts`
- Create: `hooks/reactquery/lateFeeTiers/mutations.ts`
- Create: `hooks/reactquery/lateFeeTiers/index.ts`
- Test: `hooks/reactquery/lateFeeTiers/apis.test.ts`

**Interfaces:**
- Consumes: `RateTier` shape (from Task 2) — 반환 타입이 구조적으로 `RateTier` 호환
- Produces:
  - `LateFeeRateTier { id: number; orgId: number; tierOrder: number; fromMonth: number; toMonth: number | null; monthlyRate: number }`
  - `listLateFeeRateTiers(orgId: number): Promise<LateFeeRateTier[]>`
  - `replaceLateFeeRateTiers(orgId: number, tiers: LateFeeRateTierInput[]): Promise<void>` (전체 교체 = delete-all + insert)
  - `useLateFeeRateTiers(orgId: number | null)`, `useReplaceLateFeeRateTiers()`

**설계 메모:** 요율표는 구간 몇 개짜리 작은 집합이라, 행 단위 CRUD보다 **"전체 교체"** 가 단순·안전(순서·경계 일관성 보장). 모달에서 편집 후 저장 시 org 전체 tiers를 교체한다.

- [ ] **Step 1: keys.ts**

```typescript
export const lateFeeTierKeys = {
  all: ["lateFeeTiers"] as const,
  list: (orgId: number) => ["lateFeeTiers", "list", orgId] as const,
};
```

- [ ] **Step 2: Write the failing test (apis 매퍼)**

`hooks/reactquery/lateFeeTiers/apis.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { rowToLateFeeRateTier } from "./apis";

describe("lateFeeTiers/apis", () => {
  it("rowToLateFeeRateTier: snake→camel, to_month null 보존", () => {
    expect(
      rowToLateFeeRateTier({
        id: 7,
        org_id: 3,
        tier_order: 2,
        from_month: 1,
        to_month: 3,
        monthly_rate: "1.2000",
      }),
    ).toEqual({
      id: 7,
      orgId: 3,
      tierOrder: 2,
      fromMonth: 1,
      toMonth: 3,
      monthlyRate: 1.2,
    });
    expect(
      rowToLateFeeRateTier({
        id: 8,
        org_id: 3,
        tier_order: 3,
        from_month: 3,
        to_month: null,
        monthly_rate: "1.5000",
      }).toMonth,
    ).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run hooks/reactquery/lateFeeTiers/apis.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: apis.ts**

기존 `hooks/reactquery/feeItems/apis.ts`의 supabase import·매퍼 패턴을 따른다(같은 `createClient` 경로 사용).

```typescript
import { createClient } from "@/lib/supabase/client";

export interface LateFeeRateTier {
  id: number;
  orgId: number;
  tierOrder: number;
  fromMonth: number;
  toMonth: number | null;
  monthlyRate: number;
}

export interface LateFeeRateTierInput {
  tierOrder: number;
  fromMonth: number;
  toMonth: number | null;
  monthlyRate: number;
}

interface LateFeeRateTierRow {
  id: number;
  org_id: number;
  tier_order: number;
  from_month: number;
  to_month: number | null;
  monthly_rate: number | string;
}

export function rowToLateFeeRateTier(row: LateFeeRateTierRow): LateFeeRateTier {
  return {
    id: row.id,
    orgId: row.org_id,
    tierOrder: row.tier_order,
    fromMonth: row.from_month,
    toMonth: row.to_month,
    monthlyRate: Number(row.monthly_rate),
  };
}

export async function listLateFeeRateTiers(
  orgId: number,
): Promise<LateFeeRateTier[]> {
  const { data, error } = await createClient()
    .from("late_fee_rate_tiers")
    .select("*")
    .eq("org_id", orgId)
    .order("tier_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToLateFeeRateTier);
}

/** org 요율표 전체 교체: 기존 삭제 후 신규 삽입. */
export async function replaceLateFeeRateTiers(
  orgId: number,
  tiers: LateFeeRateTierInput[],
): Promise<void> {
  const client = createClient();
  const del = await client
    .from("late_fee_rate_tiers")
    .delete()
    .eq("org_id", orgId);
  if (del.error) throw new Error(del.error.message);
  if (tiers.length === 0) return;
  const rows = tiers.map((t) => ({
    org_id: orgId,
    tier_order: t.tierOrder,
    from_month: t.fromMonth,
    to_month: t.toMonth,
    monthly_rate: t.monthlyRate,
  }));
  const ins = await client.from("late_fee_rate_tiers").insert(rows);
  if (ins.error) throw new Error(ins.error.message);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run hooks/reactquery/lateFeeTiers/apis.test.ts`
Expected: PASS.

- [ ] **Step 6: queries.ts + mutations.ts + index.ts**

`queries.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { listLateFeeRateTiers } from "./apis";
import { lateFeeTierKeys } from "./keys";

export function useLateFeeRateTiers(orgId: number | null) {
  return useQuery({
    queryKey: lateFeeTierKeys.list(orgId ?? 0),
    queryFn: () => listLateFeeRateTiers(orgId as number),
    enabled: orgId !== null,
  });
}
```

`mutations.ts`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { replaceLateFeeRateTiers, type LateFeeRateTierInput } from "./apis";
import { lateFeeTierKeys } from "./keys";

export function useReplaceLateFeeRateTiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      tiers,
    }: {
      orgId: number;
      tiers: LateFeeRateTierInput[];
    }) => replaceLateFeeRateTiers(orgId, tiers),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: lateFeeTierKeys.all }),
  });
}
```

`index.ts`:

```typescript
export * from "./apis";
export * from "./keys";
export * from "./queries";
export * from "./mutations";
```

- [ ] **Step 7: Commit**

```bash
git add hooks/reactquery/lateFeeTiers
git commit -m "feat(overdue): 연체료 요율표 CRUD 훅(lateFeeTiers)"
```

---

### Task 4: overdue periods 조회 확장

**Files:**
- Modify: `hooks/reactquery/overdue/apis.ts` (신규 `listOverduePeriods` + 타입 추가)
- Modify: `hooks/reactquery/overdue/keys.ts` (periods 키 추가)
- Modify: `hooks/reactquery/overdue/queries.ts` (`useOverduePeriods` 추가)
- Test: `hooks/reactquery/overdue/apis.test.ts` (없으면 생성; periods 매퍼 테스트)

**Interfaces:**
- Consumes: 기존 `OverdueQueryParams`/`resolveOverdueQuery`(overdue apis 내 기존 헬퍼), RPC `list_overdue_periods`(Task 1)
- Produces:
  - `OverduePeriodRow { occupancyId: number; unitId: number; period: string; unpaidPrincipal: number; dueDate: string }`
  - `listOverduePeriods(buildingId: number, query): Promise<OverduePeriodRow[]>`
  - `overdueKeys.periods(buildingId, year, month, scope)`
  - `useOverduePeriods(buildingId: number | null, params)`

- [ ] **Step 1: keys.ts에 periods 키 추가**

`hooks/reactquery/overdue/keys.ts`의 `overdueKeys` 객체에 추가(기존 `households` 옆):

```typescript
  periods: (
    buildingId: number,
    year = new Date().getFullYear(),
    month = new Date().getMonth() + 1,
    scope: OverdueScope = "all",
  ) => ["overdue", "periods", buildingId, year, month, scope] as const,
```

- [ ] **Step 2: Write the failing test**

`hooks/reactquery/overdue/apis.test.ts` (기존 파일 있으면 케이스 추가):

```typescript
import { describe, it, expect } from "vitest";
import { rowToOverduePeriod } from "./apis";

describe("overdue/apis periods", () => {
  it("rowToOverduePeriod: snake→camel", () => {
    expect(
      rowToOverduePeriod({
        occupancy_id: 11,
        unit_id: 22,
        period: "2026-03-01",
        unpaid_principal: 100000,
        due_date: "2026-03-31",
      }),
    ).toEqual({
      occupancyId: 11,
      unitId: 22,
      period: "2026-03-01",
      unpaidPrincipal: 100000,
      dueDate: "2026-03-31",
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run hooks/reactquery/overdue/apis.test.ts`
Expected: FAIL — `rowToOverduePeriod` 없음.

- [ ] **Step 4: apis.ts에 추가**

`hooks/reactquery/overdue/apis.ts`에 추가(기존 `listOverdueHouseholds`·`resolveOverdueQuery`는 그대로 두고 아래를 append). RPC 호출은 기존 `list_overdue_aggregates` 호출부(파일 내)와 동일한 client 사용 방식을 따른다.

```typescript
export interface OverduePeriodRow {
  occupancyId: number;
  unitId: number;
  period: string;
  unpaidPrincipal: number;
  dueDate: string;
}

interface OverduePeriodRpcRow {
  occupancy_id: number;
  unit_id: number;
  period: string;
  unpaid_principal: number;
  due_date: string;
}

export function rowToOverduePeriod(row: OverduePeriodRpcRow): OverduePeriodRow {
  return {
    occupancyId: row.occupancy_id,
    unitId: row.unit_id,
    period: row.period,
    unpaidPrincipal: Number(row.unpaid_principal),
    dueDate: row.due_date,
  };
}

export async function listOverduePeriods(
  buildingId: number,
  params: OverdueQueryParams = {},
): Promise<OverduePeriodRow[]> {
  const query = resolveOverdueQuery(params);
  const client = createClient();
  const { data, error } = await client.rpc("list_overdue_periods", {
    p_building_id: buildingId,
    p_target_year: query.year,
    p_target_month: query.month,
    p_scope: query.scope,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as OverduePeriodRpcRow[]).map(rowToOverduePeriod);
}
```

**주의:** `createClient` import·`OverdueQueryParams`·`resolveOverdueQuery`가 파일 상단에 이미 있는지 확인하고, 없으면 기존 import에 맞춰 사용(이미 `list_overdue_aggregates`를 호출하므로 존재함).

- [ ] **Step 5: queries.ts에 추가**

```typescript
import { listOverduePeriods } from "./apis";

export function useOverduePeriods(
  buildingId: number | null,
  params: OverdueQueryParams = {},
) {
  const query = resolveOverdueQuery(params);
  return useQuery({
    queryKey: overdueKeys.periods(
      buildingId ?? 0,
      query.year,
      query.month,
      query.scope,
    ),
    queryFn: () => listOverduePeriods(buildingId as number, query),
    enabled: buildingId !== null,
  });
}
```

**주의:** `resolveOverdueQuery`·`OverdueQueryParams`가 queries.ts에서 접근 가능하도록 import(기존 `useOverdueHouseholds`가 이미 사용 중이면 동일 import 재사용).

- [ ] **Step 6: Run tests**

Run: `npx vitest run hooks/reactquery/overdue/apis.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add hooks/reactquery/overdue
git commit -m "feat(overdue): list_overdue_periods 조회 훅 추가"
```

---

### Task 5: 세대 행에 연체료 병합 (page.tsx)

**Files:**
- Modify: `hooks/reactquery/overdue/apis.ts` (`OverdueHousehold`에 optional 필드 추가)
- Modify: `app/(staff)/staff/overdue/page.tsx`

**Interfaces:**
- Consumes: `useLateFeeRateTiers`(Task 3), `useOverduePeriods`(Task 4), `computeLateFee`(Task 2), `useMe`
- Produces: 표/모달로 전달되는 행이 `lateFeeAmount: number`, `lateFeeByPeriod: LateFeePeriodResult[]`를 포함

- [ ] **Step 1: OverdueHousehold 타입 확장**

`hooks/reactquery/overdue/apis.ts`의 `OverdueHousehold` 인터페이스 끝에 추가:

```typescript
  lateFeeAmount?: number;
  lateFeeByPeriod?: import("@/lib/billing/lateFee").LateFeePeriodResult[];
```

- [ ] **Step 2: page.tsx에서 데이터 병합**

`app/(staff)/staff/overdue/page.tsx` 상단 import 추가:

```typescript
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import { useOverduePeriods } from "@/hooks/reactquery/overdue";
import { computeLateFee } from "@/lib/billing/lateFee";
import { useMemo } from "react"; // 이미 있으면 생략
```

기존 `useOverdueHouseholds(...)` 호출 근처(같은 컴포넌트 본문, `me`·`selectedBuildingId`·`query`가 정의된 위치 아래)에 추가:

```typescript
  const { data: tiers = [] } = useLateFeeRateTiers(me?.orgId ?? null);
  const { data: overduePeriods = [] } = useOverduePeriods(selectedBuildingId, query);

  const rowsWithLateFee = useMemo(() => {
    const baseRows = households ?? [];
    if (baseRows.length === 0) return baseRows;
    const byOcc = new Map<number, { period: string; unpaidPrincipal: number; dueDate: string }[]>();
    for (const p of overduePeriods) {
      const list = byOcc.get(p.occupancyId) ?? [];
      list.push({ period: p.period, unpaidPrincipal: p.unpaidPrincipal, dueDate: p.dueDate });
      byOcc.set(p.occupancyId, list);
    }
    return baseRows.map((row) => {
      const result = computeLateFee(byOcc.get(row.occupancyId) ?? [], tiers, query.year, query.month);
      return { ...row, lateFeeAmount: result.totalLateFee, lateFeeByPeriod: result.byPeriod };
    });
  }, [households, overduePeriods, tiers, query.year, query.month]);
```

**주의:** 실제 변수명(`households`·`selectedBuildingId`·`query`)은 page.tsx의 기존 명명을 그대로 확인해 맞출 것. 조회 결과 변수가 `data: households`가 아니면 그 이름을 사용. `query.year`/`query.month`는 `resolveOverdueQuery` 결과 형태를 따른다(툴바 상태에서 파생되는 현재 조회 년·월).

- [ ] **Step 3: 표/후속 로직이 rowsWithLateFee를 쓰도록 교체**

기존에 `households`(또는 조회 rows)를 `OverdueTable rows=...`, 통계, CSV, 채권필터에 넘기던 부분을 `rowsWithLateFee` 기준으로 교체. (필터/정렬 파생값도 `rowsWithLateFee`에서 계산.)

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add hooks/reactquery/overdue/apis.ts "app/(staff)/staff/overdue/page.tsx"
git commit -m "feat(overdue): 세대 행에 연체료 병합(요율표×월분)"
```

---

### Task 6: 미납표에 연체료 컬럼 + 합계행

**Files:**
- Modify: `app/(staff)/staff/overdue/components/OverdueTable.tsx`
- Test: `app/(staff)/staff/overdue/components/OverdueTable.test.tsx` (없으면 생성)

**Interfaces:**
- Consumes: `rows: OverdueHousehold[]`(이제 `lateFeeAmount` 포함), `formatWon`(from `../utils`)

- [ ] **Step 1: Write the failing test**

`app/(staff)/staff/overdue/components/OverdueTable.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OverdueTable } from "./OverdueTable";
import type { OverdueHousehold } from "@/hooks/reactquery/overdue";

const row = {
  occupancyId: 1,
  unitId: 1,
  buildingId: 1,
  buildingName: "그린빌라",
  unitNo: "101호",
  dong: "A동",
  tenantName: "김입주",
  phone: "010-0000-0000",
  status: "occupied",
  overdueMonths: 3,
  overdueAmount: 100_000,
  lastPaymentDate: null,
  billingAvailable: true,
  lateFeeAmount: 3_400,
} as unknown as OverdueHousehold;

describe("OverdueTable", () => {
  it("연체료 컬럼과 합계행을 렌더한다", () => {
    render(
      <OverdueTable
        rows={[row]}
        selectedIds={new Set()}
        onToggleOne={() => {}}
        onToggleAll={() => {}}
        onRowClick={() => {}}
      />,
    );
    expect(screen.getByText("연체료")).toBeInTheDocument();
    expect(screen.getByText("3,400원")).toBeInTheDocument();
    // 합계행: 미납금액 합계 + 연체료 합계
    expect(screen.getByText("합계")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(staff)/staff/overdue/components/OverdueTable.test.tsx"`
Expected: FAIL — "연체료"/"합계" 없음.

- [ ] **Step 3: 구현 — 헤더에 연체료 컬럼, 각 행에 값, tfoot 합계행**

`OverdueTable.tsx`의 `<thead>` 미납금액 헤더 뒤에 `<th className="px-3 py-2 text-right">연체료</th>` 추가. 각 `<tr>` 미납금액 셀 뒤에:

```tsx
<td className="px-3 py-2 text-right">{formatWon(row.lateFeeAmount ?? 0)}</td>
```

테이블 하단에 합계행 추가(`</tbody>` 뒤):

```tsx
<tfoot>
  <tr className="border-t font-bold">
    <td className="px-3 py-2" colSpan={/* 체크박스~최근납부일 앞까지 컬럼 수 */ 4}>
      합계 ({rows.length}세대)
    </td>
    <td className="px-3 py-2 text-right">
      {formatWon(rows.reduce((s, r) => s + r.overdueAmount, 0))}
    </td>
    <td className="px-3 py-2 text-right">
      {formatWon(rows.reduce((s, r) => s + (r.lateFeeAmount ?? 0), 0))}
    </td>
    <td />
  </tr>
</tfoot>
```

**주의:** `colSpan`은 기존 컬럼 배치(체크박스·호실명·입주자명·연락처·연체개월 = 앞부분)에 맞춰 정확히 계산. 최종 컬럼 순서: …연체개월 | 미납금액 | **연체료** | 최근납부일. 합계행은 미납금액·연체료 칸만 값, 최근납부일 칸은 빈 셀.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(staff)/staff/overdue/components/OverdueTable.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(staff)/staff/overdue/components/OverdueTable.tsx" "app/(staff)/staff/overdue/components/OverdueTable.test.tsx"
git commit -m "feat(overdue): 미납표 연체료 컬럼·합계행"
```

---

### Task 7: 상세 모달에 월분별 연체 내역

**Files:**
- Modify: `app/(staff)/staff/overdue/components/OverdueDetailModal.tsx`
- Test: `app/(staff)/staff/overdue/components/OverdueDetailModal.test.tsx` (없으면 생성)

**Interfaces:**
- Consumes: `household.lateFeeByPeriod`(Task 5), `formatWon`

- [ ] **Step 1: Write the failing test**

`OverdueDetailModal.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OverdueDetailModal } from "./OverdueDetailModal";
import type { OverdueHousehold } from "@/hooks/reactquery/overdue";

const household = {
  occupancyId: 1, unitId: 1, buildingId: 1, buildingName: "그린빌라",
  unitNo: "101호", dong: "A동", status: "occupied",
  overdueMonths: 3, overdueAmount: 100_000, lastPaymentDate: null, billingAvailable: true,
  lateFeeAmount: 3_400,
  lateFeeByPeriod: [
    { period: "2026-03-01", months: 3, cumulativeRatePct: 3.4, lateFee: 3_400 },
  ],
} as unknown as OverdueHousehold;

describe("OverdueDetailModal", () => {
  it("월분별 연체 내역을 렌더한다", () => {
    render(<OverdueDetailModal household={household} onClose={() => {}} />);
    expect(screen.getByText("연체료 내역")).toBeInTheDocument();
    expect(screen.getByText("2026-03")).toBeInTheDocument();
    expect(screen.getByText("3,400원")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(staff)/staff/overdue/components/OverdueDetailModal.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: 구현 — 모달에 연체료 내역 섹션 추가**

기존 "미납 정보" 섹션 아래에, `household.lateFeeByPeriod`가 있고 비어있지 않으면 렌더:

```tsx
{household.lateFeeByPeriod && household.lateFeeByPeriod.length > 0 && (
  <section>
    <h3 className="text-sm font-bold">연체료 내역</h3>
    <table className="mt-2 w-full text-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="py-1">월분</th>
          <th className="py-1 text-right">연체개월</th>
          <th className="py-1 text-right">누적요율</th>
          <th className="py-1 text-right">연체료</th>
        </tr>
      </thead>
      <tbody>
        {household.lateFeeByPeriod.map((r) => (
          <tr key={r.period} className="border-t">
            <td className="py-1">{r.period.slice(0, 7)}</td>
            <td className="py-1 text-right">{r.months}개월</td>
            <td className="py-1 text-right">{r.cumulativeRatePct.toFixed(1)}%</td>
            <td className="py-1 text-right">{formatWon(r.lateFee)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t font-bold">
          <td className="py-1" colSpan={3}>합계</td>
          <td className="py-1 text-right">{formatWon(household.lateFeeAmount ?? 0)}</td>
        </tr>
      </tfoot>
    </table>
  </section>
)}
```

**주의:** `formatWon` import 필요(모달이 아직 사용 안 하면 `../utils`에서 추가). 스타일 클래스(`text-muted` 등)는 기존 모달에서 쓰는 클래스에 맞춤.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(staff)/staff/overdue/components/OverdueDetailModal.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(staff)/staff/overdue/components/OverdueDetailModal.tsx" "app/(staff)/staff/overdue/components/OverdueDetailModal.test.tsx"
git commit -m "feat(overdue): 상세모달 월분별 연체료 내역"
```

---

### Task 8: 요율표 설정 모달 `LateFeeRateModal`

**Files:**
- Create: `app/(staff)/staff/overdue/components/LateFeeRateModal.tsx`
- Test: `app/(staff)/staff/overdue/components/LateFeeRateModal.test.tsx`
- Modify: `app/(staff)/staff/overdue/page.tsx` (버튼 + 모달 연결)

**Interfaces:**
- Consumes: `useLateFeeRateTiers`·`useReplaceLateFeeRateTiers`(Task 3), `Modal`(`@/components/common/Modal`), `Button`
- Produces: `LateFeeRateModal({ open, orgId, onClose })`

- [ ] **Step 1: Write the failing test**

`LateFeeRateModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LateFeeRateModal } from "./LateFeeRateModal";

vi.mock("@/hooks/reactquery/lateFeeTiers", () => ({
  useLateFeeRateTiers: vi.fn(() => ({
    data: [
      { id: 1, orgId: 3, tierOrder: 1, fromMonth: 0, toMonth: 1, monthlyRate: 1.0 },
      { id: 2, orgId: 3, tierOrder: 2, fromMonth: 1, toMonth: 3, monthlyRate: 1.2 },
    ],
    isLoading: false,
  })),
  useReplaceLateFeeRateTiers: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

describe("LateFeeRateModal", () => {
  it("기존 구간을 편집 가능한 행으로 렌더한다", () => {
    render(<LateFeeRateModal open orgId={3} onClose={() => {}} />);
    expect(screen.getByText("연체료 요율 설정")).toBeInTheDocument();
    expect(screen.getAllByRole("row").length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(staff)/staff/overdue/components/LateFeeRateModal.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: 구현**

`LateFeeRateModal.tsx` (구간 행 추가/삭제/편집 + 저장 시 전체 교체):

```tsx
"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { toast } from "sonner";
import {
  useLateFeeRateTiers,
  useReplaceLateFeeRateTiers,
  type LateFeeRateTierInput,
} from "@/hooks/reactquery/lateFeeTiers";

interface DraftTier {
  fromMonth: number;
  toMonth: number | null;
  monthlyRate: number;
}

export function LateFeeRateModal({
  open,
  orgId,
  onClose,
}: {
  open: boolean;
  orgId: number;
  onClose: () => void;
}) {
  const { data: tiers = [] } = useLateFeeRateTiers(open ? orgId : null);
  const replace = useReplaceLateFeeRateTiers();
  const [draft, setDraft] = useState<DraftTier[]>([]);

  useEffect(() => {
    if (open) {
      setDraft(
        tiers.map((t) => ({
          fromMonth: t.fromMonth,
          toMonth: t.toMonth,
          monthlyRate: t.monthlyRate,
        })),
      );
    }
  }, [open, tiers]);

  function update(i: number, patch: Partial<DraftTier>) {
    setDraft((d) => d.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function addRow() {
    const last = draft[draft.length - 1];
    setDraft((d) => [
      ...d,
      { fromMonth: last?.toMonth ?? 0, toMonth: null, monthlyRate: 0 },
    ]);
  }
  function removeRow(i: number) {
    setDraft((d) => d.filter((_, idx) => idx !== i));
  }

  async function save() {
    // 검증: 경계 오름차순
    for (let i = 0; i < draft.length; i += 1) {
      const t = draft[i];
      if (t.toMonth !== null && t.toMonth <= t.fromMonth) {
        toast.error("구간 끝은 시작보다 커야 합니다");
        return;
      }
    }
    const payload: LateFeeRateTierInput[] = draft.map((t, i) => ({
      tierOrder: i + 1,
      fromMonth: t.fromMonth,
      toMonth: t.toMonth,
      monthlyRate: t.monthlyRate,
    }));
    try {
      await replace.mutateAsync({ orgId, tiers: payload });
      toast.success("연체료 요율을 저장했습니다");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    }
  }

  return (
    <Modal open={open} title="연체료 요율 설정" onClose={onClose}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1">시작(초과, 개월)</th>
            <th className="py-1">끝(이하, 개월·비우면 무한)</th>
            <th className="py-1">월요율(%)</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {draft.map((t, i) => (
            <tr key={i} className="border-t">
              <td className="py-1">
                <input
                  type="number"
                  className="w-16 rounded border px-1"
                  value={t.fromMonth}
                  onChange={(e) => update(i, { fromMonth: Number(e.target.value) })}
                />
              </td>
              <td className="py-1">
                <input
                  type="number"
                  className="w-16 rounded border px-1"
                  value={t.toMonth ?? ""}
                  onChange={(e) =>
                    update(i, {
                      toMonth: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </td>
              <td className="py-1">
                <input
                  type="number"
                  step="0.1"
                  className="w-20 rounded border px-1"
                  value={t.monthlyRate}
                  onChange={(e) => update(i, { monthlyRate: Number(e.target.value) })}
                />
              </td>
              <td className="py-1">
                <button
                  type="button"
                  className="text-danger"
                  onClick={() => removeRow(i)}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-between">
        <Button variant="ghost" onClick={addRow}>
          구간 추가
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} disabled={replace.isPending}>
            저장
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

**주의:** `Button` import 경로는 기존 컴포넌트에서 쓰는 경로 확인(`@/components/common/Button` 예상). 스타일 클래스(`text-muted`·`text-danger`)는 프로젝트 관례에 맞춤.

- [ ] **Step 4: page.tsx에 버튼 + 모달 연결**

`page.tsx` 툴바/헤더 액션 영역에 billing 권한자만 보이는 버튼 추가, 모달 상태 관리:

```tsx
const [rateModalOpen, setRateModalOpen] = useState(false);
const canEditRate = hasModule(me, "billing");
// ...
{canEditRate && (
  <Button variant="ghost" onClick={() => setRateModalOpen(true)}>
    연체료 요율 설정
  </Button>
)}
// ... (return 하단)
{me?.orgId != null && (
  <LateFeeRateModal
    open={rateModalOpen}
    orgId={me.orgId}
    onClose={() => setRateModalOpen(false)}
  />
)}
```

import 추가: `import { LateFeeRateModal } from "./components/LateFeeRateModal";`

- [ ] **Step 5: Run tests + tsc**

Run: `npx vitest run "app/(staff)/staff/overdue/components/LateFeeRateModal.test.tsx" && npx tsc --noEmit`
Expected: PASS + 0 errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(staff)/staff/overdue/components/LateFeeRateModal.tsx" "app/(staff)/staff/overdue/components/LateFeeRateModal.test.tsx" "app/(staff)/staff/overdue/page.tsx"
git commit -m "feat(overdue): 연체료 요율표 설정 모달"
```

---

### Task 9: 미납대장 CSV에 연체료 컬럼

**Files:**
- Modify: `app/(staff)/staff/overdue/utils.ts`
- Modify: `app/(staff)/staff/overdue/utils.test.ts`

**Interfaces:**
- Consumes: `OverdueHousehold.lateFeeAmount`

- [ ] **Step 1: 테스트 케이스 추가(실패 확인)**

`utils.test.ts`의 CSV 테스트에 연체료 컬럼 기대 추가:

```typescript
it("CSV 헤더/본문에 연체료를 포함한다", () => {
  const csv = createOverdueLedgerCsv([
    { ...household, lateFeeAmount: 3_400 } as never,
  ]);
  expect(csv).toContain("연체료");
  expect(csv).toContain("3400");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(staff)/staff/overdue/utils.test.ts"`
Expected: FAIL — "연체료" 헤더 없음.

- [ ] **Step 3: 구현 — createOverdueLedgerCsv 수정**

`createOverdueLedgerCsv`의 `headers` 배열에서 "미납금액" 뒤에 `"연체료"` 추가, `body` 매핑에서 `row.overdueAmount` 뒤에 `row.lateFeeAmount ?? 0` 추가.

```typescript
const headers = ["건물명", "호실명", "입주자명", "연락처", "연체 개월수", "미납금액", "연체료", "최근 납부일", "데이터 상태"];
// body row: ..., row.overdueAmount, row.lateFeeAmount ?? 0, row.lastPaymentDate ?? "", ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(staff)/staff/overdue/utils.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(staff)/staff/overdue/utils.ts" "app/(staff)/staff/overdue/utils.test.ts"
git commit -m "feat(overdue): 미납대장 CSV 연체료 컬럼"
```

---

### Task 10: 전건 검증

**Files:** 없음(검증만)

- [ ] **Step 1: 타입·린트·테스트 전건**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: tsc 0 errors, lint 0 errors, vitest 전부 green.

- [ ] **Step 2: 겹침 회피 확인**

Run: `git diff --stat origin/master | grep -E "setup|/bill/|/payment/|/messaging/|management-fee" || echo "겹침 없음"`
Expected: "겹침 없음".

- [ ] **Step 3: 실패 시 수정 후 재실행**

에러가 있으면 해당 Task로 돌아가 수정하고 Step 1 재실행. 모두 통과할 때까지 반복.

---

## 실행 후

- 마이그 0026 라이브 적용은 사용자 PC에서(`supabase/tests/p8_overdue_late_fees_checks.sql`로 검증).
- master 병합 후 WBS 동기화(`wbs-commit-sync`) — 미납 관리 화면 dev 상태/비고 갱신.
- 후속(범위 밖): 고지서 연체료 라인, 수납 시 연체료 충당, building별 요율표, 소액면제·상한·일할.
