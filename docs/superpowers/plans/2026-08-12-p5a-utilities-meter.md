# P5a 검침·지침(/staff/utilities) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/staff/utilities` 스캐폴딩의 `TODO(meter)`·`TODO(p3a)`를 실데이터로 채운다 — `meter_readings`·`water_discounts` 신설, `unit_meters` 조인으로 고객/계량기번호 교정, 당월 지침 저장 + 사용량(당월−전월) 서버 계산, 수도 할인 설정 모달, 실 6개월 이력.

**Architecture:** 신규 DB(`0007`)는 `meter_readings`(세대·유형·월별 지침, 단가/자동요금은 null 자리) + `water_discounts`(세대 수도 할인, 하드삭제 config). 조회 `list_utility_rows`·저장 `save_meter_readings` definer RPC(전월 lookup·usage 서버계산·할인 스냅샷). 할인 단일행은 RLS 게이팅 upsert. `utilities` module RLS(P3b 자식테이블 패턴 계승). UI는 기존 컴포넌트 위에 실데이터 흐름 + `WaterDiscountModal` 신규 + 이력 모달 실데이터화. 신규 라우트 없음.

**Tech Stack:** Next.js 16(App Router) · Supabase(anon+RLS, `.rpc`/`.from`) · React Query v5 · Tailwind v4 · Vitest + Testing Library · sonner.

## Global Constraints

- **기준 spec:** `docs/superpowers/specs/2026-08-12-p5a-utilities-meter-design.md`. 결정(검침만·단가 미도입 / 할인=설정·표시·스냅샷·자동차감 안 함 / RPC 조회·저장 / utilities RLS / period=referenceDate 월)을 준수.
- **범위 밖:** 단가·자동요금(`unit_price`·`calc_charge`는 null 자리), `billing_confirmations`(부과확정 — `mutations.ts` TODO(p3a) 주석 유지), `exportLedger` 엑셀(현행 stub 유지), 층별·고객번호별 단가, 상가 고정 사용량.
- **DB 유형 표기:** DB는 `water`/`elec`/`gas`(P3b `unit_meters` check 계승), UI는 `water`/`electricity`/`gas` → `dbUtility()` 매핑.
- **마이그레이션 번호:** 다음은 `supabase/migrations/0007_p5a_utilities.sql`. 검증 `supabase/verify/p5a_checks.sql`.
- **DB pending-user:** 원격 미접속 → 검증은 `npm test`(vitest) + `npx tsc --noEmit` + `npm run lint` + verify SQL 정적 리뷰. 라이브 적용·E2E는 사용자 PC(순서 …0005→0006→**0007**). 스캐폴딩이 이미 0006 기준이므로 0006 미적용 환경은 0006까지 함께 적용해야 동작.
- **컨벤션:** snake↔camel 매핑은 `apis.ts`, 공용 프리미티브 `@/components/common`(`Modal {open,onClose,title,children}`, `Button {variant}`, `Select`, `Tabs`), RLS `org_id in (select my_org_ids())` 이디엄, 단일행 upsert `.upsert(payload,{onConflict})`, 뮤테이션 `useMutation + qc.invalidateQueries`. alias `@/` = 루트.
- **개별 테스트:** `npx vitest run <path>`(괄호 경로는 따옴표). 타입 `npx tsc --noEmit`, 린트 `npm run lint`.
- **커밋 트레일러(필수):** 모든 커밋 끝에 `-m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`.
- **WBS:** 화면 커밋 직후에만 `wbs-commit-sync`(주택관리ERP, `완료` 자동변경 금지). 화면 반영은 Task 6.

## File Structure

**DB**: `supabase/migrations/0007_p5a_utilities.sql`, `supabase/verify/p5a_checks.sql`.
**데이터층 (`hooks/reactquery/utilities/`)**: `apis.ts`(재작성: `list_utility_rows` RPC·`dbUtility`·discount 필드·`saveMeterReadings`·`saveWaterDiscount`·`deleteWaterDiscount`·`listMeterHistory`), `keys.ts`(period·history), `queries.ts`(`useUtilityRows(…,period)`·`useMeterHistory`), `mutations.ts`(3 뮤테이션, TODO(p3a) 주석 유지), `apis.test.ts`(재작성).
**페이지·컴포넌트 (`app/(staff)/staff/utilities/`)**: `page.tsx`(period 파생·`calculateCharges` 실저장·할인 버튼), `components/UtilityHistoryModal.tsx`(실데이터), `components/UtilityTable.tsx`(할인 뱃지), `components/WaterDiscountModal.tsx`(신규). 테스트 `page.test.tsx`(갱신), `components/WaterDiscountModal.test.tsx`(신규).

---

## 그룹 1 — DB · 데이터 계층

### Task 1: 마이그레이션 0007 + 검증 SQL

**Files:**
- Create: `supabase/migrations/0007_p5a_utilities.sql`
- Create: `supabase/verify/p5a_checks.sql`

**Interfaces:**
- Produces: 테이블 `meter_readings`·`water_discounts`; RPC `list_utility_rows(bigint,text,date)→setof`·`save_meter_readings(bigint,text,date,jsonb)→jsonb`; RLS(utilities).
- Consumes: P0 `set_updated_at`·`my_org_ids`; P1a `units`·`buildings`; P2a `current_user_org`·`current_user_has_module`; P3b `unit_meters`·`occupancies`(확장)·`occupancy_status` enum.

> **TDD 예외:** 원격 DB 미접속으로 vitest 대상 아님. "테스트"는 `p5a_checks.sql` + spec §3~§5 대조 정적 리뷰.

- [ ] **Step 1: `0007_p5a_utilities.sql` 작성**

```sql
-- P5a: 검침·지침(/staff/utilities)
-- 의존: P1a(units, buildings), P2a(current_user_org, current_user_has_module, my_org_ids, set_updated_at),
--       P3b(unit_meters, occupancies 확장, occupancy_status)

-- ===== meter_readings: 세대·유형·월별 지침 이력 =====
create table meter_readings (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  utility text not null check (utility in ('water','elec','gas')),
  period  date not null,                 -- 월1일 정규화
  previous_reading numeric(12,2),
  current_reading  numeric(12,2),
  usage            numeric(12,2),
  unit_price       numeric(12,2),        -- 단가: 미도입(null 자리)
  calc_charge      integer,              -- 자동요금: 미도입(null 자리)
  discount_amount  integer,              -- 계산 시 water_discounts 스냅샷
  manual_charge    integer,
  note             text,
  processed_at     timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, utility, period)
);
create index on meter_readings (unit_id, utility, period desc);

-- ===== water_discounts: 세대 수도 할인(config, 하드삭제) =====
create table water_discounts (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  discount_type text not null check (discount_type in ('recipient','multichild','other')),
  amount integer not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id)
);
create index on water_discounts (unit_id);

-- ===== updated_at 트리거 =====
do $$ declare t text; begin
  foreach t in array array['meter_readings','water_discounts'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- ===== RLS: select org 개방 / write utilities 모듈 =====
alter table meter_readings  enable row level security;
alter table water_discounts enable row level security;

create policy mr_select on meter_readings for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy mr_write on meter_readings for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'));
create policy wd_select on water_discounts for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy wd_write on water_discounts for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'));

-- ===== 조회 RPC =====
create or replace function list_utility_rows(
  p_building_id bigint, p_utility text, p_period date
) returns table(
  unit_id bigint, unit_no text, dong text,
  occupancy_id bigint, tenant_name text, occupancy_status occupancy_status, move_in_date date,
  customer_no text, meter_no text,
  previous_reading numeric, current_reading numeric, usage numeric,
  unit_price numeric, calc_charge integer, discount_amount integer,
  manual_charge integer, note text, processed_at timestamptz,
  discount_type text
) language sql stable security definer set search_path = public as $$
  select u.id, u.unit_no, u.dong,
    o.id, o.tenant_name, o.status, o.move_in_date,
    m.customer_no, m.meter_no,
    coalesce(cur.previous_reading, prev.current_reading) as previous_reading,
    cur.current_reading, cur.usage,
    cur.unit_price, cur.calc_charge,
    coalesce(cur.discount_amount, wd.amount) as discount_amount,
    cur.manual_charge, cur.note, cur.processed_at,
    wd.discount_type
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select * from occupancies oc where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc limit 1
  ) o on true
  left join unit_meters   m    on m.unit_id = u.id and m.utility = p_utility
  left join meter_readings cur  on cur.unit_id = u.id and cur.utility = p_utility and cur.period = p_period
  left join meter_readings prev on prev.unit_id = u.id and prev.utility = p_utility
                                and prev.period = (p_period - interval '1 month')::date
  left join water_discounts wd  on wd.unit_id = u.id and p_utility = 'water'
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;
revoke execute on function list_utility_rows(bigint,text,date) from anon;

-- ===== 저장 RPC(원자적) =====
create or replace function save_meter_readings(
  p_building_id bigint, p_utility text, p_period date, p_rows jsonb  -- [{unit_id, current_reading, manual_charge, note}]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_item jsonb; v_count int := 0;
  v_unit_id bigint; v_prev numeric; v_cur numeric; v_usage numeric; v_disc integer;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then raise exception 'forbidden: utilities required'; end if;
  if p_utility not in ('water','elec','gas') then raise exception 'bad utility %', p_utility; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    v_unit_id := (v_item->>'unit_id')::bigint;
    if not exists (select 1 from units u join buildings b on b.id=u.building_id
                   where u.id=v_unit_id and u.building_id=p_building_id and b.org_id=v_org) then
      raise exception 'unit % not in building/org', v_unit_id; end if;

    v_cur := nullif(v_item->>'current_reading','')::numeric;
    select current_reading into v_prev from meter_readings
      where unit_id=v_unit_id and utility=p_utility and period=(p_period - interval '1 month')::date;
    v_usage := case when v_cur is not null and v_prev is not null then v_cur - v_prev end;
    select amount into v_disc from water_discounts
      where unit_id=v_unit_id and p_utility='water';

    insert into meter_readings(unit_id, utility, period, previous_reading, current_reading, usage,
        discount_amount, manual_charge, note, processed_at)
      values (v_unit_id, p_utility, p_period, v_prev, v_cur, v_usage,
        v_disc, nullif(v_item->>'manual_charge','')::integer, nullif(v_item->>'note',''), now())
      on conflict (unit_id, utility, period) do update set
        previous_reading=excluded.previous_reading, current_reading=excluded.current_reading,
        usage=excluded.usage, discount_amount=excluded.discount_amount,
        manual_charge=excluded.manual_charge, note=excluded.note, processed_at=now();
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('saved', v_count, 'period', p_period);
end $$;
revoke execute on function save_meter_readings(bigint,text,date,jsonb) from anon;
```

- [ ] **Step 2: `p5a_checks.sql` 작성**

```sql
-- P5a 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  if (select count(*) from information_schema.tables where table_name in ('meter_readings','water_discounts')) <> 2
    then raise exception 'P5a tables missing'; end if;
  perform 1 from information_schema.columns where table_name='meter_readings' and column_name='period';
  if not found then raise exception 'meter_readings.period missing'; end if;
end $$;
do $$ begin
  perform 1 from pg_policies where tablename='meter_readings' and policyname='mr_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'mr_write must gate by utilities module'; end if;
  perform 1 from pg_policies where tablename='water_discounts' and policyname='wd_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'wd_write must gate by utilities module'; end if;
  if (select count(*) from pg_proc where proname in ('list_utility_rows','save_meter_readings')) <> 2
    then raise exception 'P5a RPC missing'; end if;
end $$;
-- 수동: utilities 미보유 구성원 meter_readings SELECT 가능·INSERT 거부; save_meter_readings 로 usage=당월−전월·할인 스냅샷 확인;
--       list_utility_rows 전월 previous_reading 채움·water 할인만; 타 org building_id 거부.
```

- [ ] **Step 3: 정적 리뷰 & 커밋**

spec §3~§5 대조(컬럼·정책·RPC 시그니처). 라이브 실행 없음.

```bash
git add supabase/migrations/0007_p5a_utilities.sql supabase/verify/p5a_checks.sql
git commit -m "feat(db): P5a 검침 스키마 meter_readings·water_discounts·list_utility_rows/save_meter_readings RPC·utilities RLS(0007)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `utilities` 데이터층 재작성 (apis·keys·queries·mutations)

**Files:**
- Modify(전체 교체): `hooks/reactquery/utilities/apis.ts`, `keys.ts`, `queries.ts`, `mutations.ts`, `apis.test.ts`

**Interfaces:**
- Produces: `UtilityType`·`UtilityUnitRow`(+`discountType`·`discountAmount`)·`dbUtility(type)`; `listUtilityRows(buildingId,type,period)`·`saveMeterReadings(input)`·`saveWaterDiscount(input)`·`deleteWaterDiscount(unitId)`·`listMeterHistory(unitId,type,period)`·`MeterHistoryRow`·`SaveMeterReadingsInput/Result`·`SaveWaterDiscountInput`; `utilityKeys`; `useUtilityRows(buildingId,type,period)`·`useMeterHistory(unitId,type,period)`·`useSaveMeterReadings`·`useSaveWaterDiscount`·`useDeleteWaterDiscount`.
- Consumes: `createClient`; `save_meter_readings`·`list_utility_rows` RPC(T1).

- [ ] **Step 1: 실패 테스트 작성** (`apis.test.ts` 전체 교체)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));

import {
  dbUtility, listUtilityRows, saveMeterReadings, saveWaterDiscount, deleteWaterDiscount, listMeterHistory,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("utilities apis", () => {
  it("dbUtility: electricity→elec, 나머지 그대로", () => {
    expect(dbUtility("electricity")).toBe("elec");
    expect(dbUtility("water")).toBe("water");
    expect(dbUtility("gas")).toBe("gas");
  });

  it("listUtilityRows: list_utility_rows RPC(elec 매핑) + snake→camel", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 101, unit_no: "101호", dong: "A동", occupancy_id: 9, tenant_name: "홍길동",
      occupancy_status: "occupied", move_in_date: "2026-08-01", customer_no: "E-101", meter_no: "M-101",
      previous_reading: 100, current_reading: 158, usage: 58, unit_price: null, calc_charge: null,
      discount_amount: null, manual_charge: null, note: null, processed_at: null, discount_type: null,
    }], error: null });

    const rows = await listUtilityRows(3, "electricity", "2026-08-01");

    expect(rpc).toHaveBeenCalledWith("list_utility_rows", { p_building_id: 3, p_utility: "elec", p_period: "2026-08-01" });
    expect(rows[0]).toMatchObject({
      unitId: 101, unitNo: "101호", dong: "A동", occupancyId: 9, tenantName: "홍길동",
      occupancyStatus: "occupied", customerNumber: "E-101", meterNumber: "M-101",
      previousReading: 100, currentReading: 158, usage: 58, automaticCharge: null,
      discountType: null, discountAmount: null,
    });
  });

  it("listUtilityRows: 수도 할인 세대 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 201, unit_no: "201호", dong: null, occupancy_id: 5, tenant_name: "김수급",
      occupancy_status: "occupied", move_in_date: null, customer_no: "W-201", meter_no: null,
      previous_reading: null, current_reading: null, usage: null, unit_price: null, calc_charge: null,
      discount_amount: 3000, manual_charge: null, note: null, processed_at: null, discount_type: "recipient",
    }], error: null });
    const [row] = await listUtilityRows(3, "water", "2026-08-01");
    expect(row).toMatchObject({ discountType: "recipient", discountAmount: 3000 });
  });

  it("saveMeterReadings: save_meter_readings payload + 결과", async () => {
    rpc.mockResolvedValue({ data: { saved: 2, period: "2026-08-01" }, error: null });
    const res = await saveMeterReadings({
      buildingId: 3, utilityType: "water", period: "2026-08-01",
      rows: [{ unit_id: 101, current_reading: "158", manual_charge: "", note: "" }],
    });
    expect(rpc).toHaveBeenCalledWith("save_meter_readings", {
      p_building_id: 3, p_utility: "water", p_period: "2026-08-01",
      p_rows: [{ unit_id: 101, current_reading: "158", manual_charge: "", note: "" }],
    });
    expect(res).toEqual({ saved: 2, period: "2026-08-01" });
  });

  it("saveWaterDiscount: unit_id onConflict upsert", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    await saveWaterDiscount({ unitId: 101, discountType: "multichild", amount: 5000, memo: "3자녀" });
    expect(from).toHaveBeenCalledWith("water_discounts");
    expect(upsert).toHaveBeenCalledWith(
      { unit_id: 101, discount_type: "multichild", amount: 5000, memo: "3자녀" },
      { onConflict: "unit_id" },
    );
  });

  it("deleteWaterDiscount: unit_id 삭제", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq }));
    from.mockReturnValue({ delete: del });
    await deleteWaterDiscount(101);
    expect(eq).toHaveBeenCalledWith("unit_id", 101);
  });

  it("listMeterHistory: 유형(elec) + period 이하 6건 + charge=calc?? manual", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [
      { period: "2026-08-01", manual_charge: 12000, calc_charge: null, unit_price: null },
      { period: "2026-07-01", manual_charge: null, calc_charge: 9000, unit_price: 900 },
    ], error: null });
    const order = vi.fn(() => ({ limit }));
    const lte = vi.fn(() => ({ order }));
    const eq2 = vi.fn(() => ({ lte }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    from.mockReturnValue({ select: () => ({ eq: eq1 }) });
    const hist = await listMeterHistory(101, "electricity", "2026-08-01");
    expect(from).toHaveBeenCalledWith("meter_readings");
    expect(eq2).toHaveBeenCalledWith("utility", "elec");
    expect(hist).toEqual([
      { period: "2026-08-01", charge: 12000, unitPrice: null },
      { period: "2026-07-01", charge: 9000, unitPrice: 900 },
    ]);
  });

  it("RPC 오류를 전달한다", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "조회 실패" } });
    await expect(listUtilityRows(3, "water", "2026-08-01")).rejects.toThrow("조회 실패");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/utilities/apis.test.ts` · Expected: FAIL(모듈/함수 미정의).

- [ ] **Step 3: 구현 — `apis.ts` 전체 교체**

```ts
import { createClient } from "@/lib/supabase/client";

export const UTILITY_TYPES = ["water", "electricity", "gas"] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

/** DB(unit_meters·meter_readings)는 'elec'을 쓴다(UI는 electricity). */
export function dbUtility(type: UtilityType): "water" | "elec" | "gas" {
  return type === "electricity" ? "elec" : type;
}

export interface UtilityUnitRow {
  unitId: number;
  unitNo: string;
  dong: string | null;
  occupancyId: number | null;
  tenantName: string | null;
  occupancyStatus: "occupied" | "vacant" | "moving_out" | null;
  moveInDate: string | null;
  customerNumber: string | null;
  meterNumber: string | null;
  previousReading: number | null;
  currentReading: number | null;
  usage: number | null;
  automaticCharge: number | null;
  manualCharge: number | null;
  note: string | null;
  processedAt: string | null;
  discountType: string | null;
  discountAmount: number | null;
}

interface UtilityRowRpc {
  unit_id: number; unit_no: string; dong: string | null;
  occupancy_id: number | null; tenant_name: string | null;
  occupancy_status: UtilityUnitRow["occupancyStatus"]; move_in_date: string | null;
  customer_no: string | null; meter_no: string | null;
  previous_reading: number | null; current_reading: number | null; usage: number | null;
  unit_price: number | null; calc_charge: number | null; discount_amount: number | null;
  manual_charge: number | null; note: string | null; processed_at: string | null;
  discount_type: string | null;
}

function rpcToUtilityRow(r: UtilityRowRpc): UtilityUnitRow {
  return {
    unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong,
    occupancyId: r.occupancy_id, tenantName: r.tenant_name,
    occupancyStatus: r.occupancy_status, moveInDate: r.move_in_date,
    customerNumber: r.customer_no, meterNumber: r.meter_no,
    previousReading: r.previous_reading, currentReading: r.current_reading, usage: r.usage,
    automaticCharge: r.calc_charge, manualCharge: r.manual_charge,
    note: r.note, processedAt: r.processed_at,
    discountType: r.discount_type, discountAmount: r.discount_amount,
  };
}

/** period: 'YYYY-MM-01'(월1일). */
export async function listUtilityRows(
  buildingId: number, utilityType: UtilityType, period: string,
): Promise<UtilityUnitRow[]> {
  const { data, error } = await createClient().rpc("list_utility_rows", {
    p_building_id: buildingId, p_utility: dbUtility(utilityType), p_period: period,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as UtilityRowRpc[]).map(rpcToUtilityRow);
}

export interface SaveMeterReadingsInput {
  buildingId: number;
  utilityType: UtilityType;
  period: string;
  rows: { unit_id: number; current_reading: string; manual_charge: string; note: string }[];
}
export interface SaveMeterReadingsResult { saved: number; period: string; }

export async function saveMeterReadings(input: SaveMeterReadingsInput): Promise<SaveMeterReadingsResult> {
  const { data, error } = await createClient().rpc("save_meter_readings", {
    p_building_id: input.buildingId, p_utility: dbUtility(input.utilityType),
    p_period: input.period, p_rows: input.rows,
  });
  if (error) throw new Error(error.message);
  const d = data as { saved: number; period: string };
  return { saved: d.saved, period: d.period };
}

export type WaterDiscountType = "recipient" | "multichild" | "other";
export interface SaveWaterDiscountInput {
  unitId: number; discountType: WaterDiscountType; amount: number; memo?: string | null;
}

export async function saveWaterDiscount(input: SaveWaterDiscountInput): Promise<void> {
  const { error } = await createClient().from("water_discounts").upsert(
    { unit_id: input.unitId, discount_type: input.discountType, amount: input.amount, memo: input.memo ?? null },
    { onConflict: "unit_id" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteWaterDiscount(unitId: number): Promise<void> {
  const { error } = await createClient().from("water_discounts").delete().eq("unit_id", unitId);
  if (error) throw new Error(error.message);
}

export interface MeterHistoryRow { period: string; charge: number | null; unitPrice: number | null; }

export async function listMeterHistory(
  unitId: number, utilityType: UtilityType, period: string,
): Promise<MeterHistoryRow[]> {
  const { data, error } = await createClient()
    .from("meter_readings")
    .select("period, manual_charge, calc_charge, unit_price")
    .eq("unit_id", unitId)
    .eq("utility", dbUtility(utilityType))
    .lte("period", period)
    .order("period", { ascending: false })
    .limit(6);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { period: string; manual_charge: number | null; calc_charge: number | null; unit_price: number | null }[])
    .map((r) => ({ period: r.period, charge: r.calc_charge ?? r.manual_charge, unitPrice: r.unit_price }));
}
```

- [ ] **Step 4: 구현 — `keys.ts` 전체 교체**

```ts
import type { UtilityType } from "./apis";

export const utilityKeys = {
  all: ["utilities"] as const,
  rows: (buildingId: number | null, utilityType: UtilityType, period: string) =>
    ["utilities", "rows", buildingId, utilityType, period] as const,
  history: (unitId: number | null, utilityType: UtilityType, period: string) =>
    ["utilities", "history", unitId, utilityType, period] as const,
};
```

- [ ] **Step 5: 구현 — `queries.ts` 전체 교체**

```ts
import { useQuery } from "@tanstack/react-query";
import { listUtilityRows, listMeterHistory, type UtilityType } from "./apis";
import { utilityKeys } from "./keys";

export function useUtilityRows(
  buildingId: number | null, utilityType: UtilityType, period: string,
) {
  return useQuery({
    queryKey: utilityKeys.rows(buildingId, utilityType, period),
    queryFn: () => listUtilityRows(buildingId as number, utilityType, period),
    enabled: buildingId !== null,
  });
}

export function useMeterHistory(
  unitId: number | null, utilityType: UtilityType, period: string,
) {
  return useQuery({
    queryKey: utilityKeys.history(unitId, utilityType, period),
    queryFn: () => listMeterHistory(unitId as number, utilityType, period),
    enabled: unitId !== null,
  });
}
```

- [ ] **Step 6: 구현 — `mutations.ts` 전체 교체** (TODO(p3a) 부과확정 주석 유지)

```ts
// TODO(p3a): 부과 원장(billing_confirmations) 스키마가 확정되면 계산 결과 확정 mutation을 P5 /management-fee에 추가한다.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveMeterReadings, saveWaterDiscount, deleteWaterDiscount,
  type SaveMeterReadingsInput, type SaveWaterDiscountInput,
} from "./apis";
import { utilityKeys } from "./keys";

export function useSaveMeterReadings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMeterReadingsInput) => saveMeterReadings(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: utilityKeys.all }),
  });
}

export function useSaveWaterDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWaterDiscountInput) => saveWaterDiscount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: utilityKeys.all }),
  });
}

export function useDeleteWaterDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unitId: number) => deleteWaterDiscount(unitId),
    onSuccess: () => qc.invalidateQueries({ queryKey: utilityKeys.all }),
  });
}
```

> `index.ts`는 기존 `export * from "./apis"; ./keys; ./queries; ./mutations` 유지(변경 없음).

- [ ] **Step 7: 통과 확인** — Run: `npx vitest run hooks/reactquery/utilities/apis.test.ts` · Expected: PASS(8).

- [ ] **Step 8: 커밋**

```bash
git add hooks/reactquery/utilities
git commit -m "feat(utilities): 데이터층을 list_utility_rows/save_meter_readings RPC·unit_meters 조인으로 재작성(검침·할인·이력 훅)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 그룹 2 — 저장·계산 플로우

### Task 3: `page.tsx` 실저장 + period 파생 + page.test 갱신

**Files:**
- Modify: `app/(staff)/staff/utilities/page.tsx`
- Modify: `app/(staff)/staff/utilities/page.test.tsx`

**Interfaces:**
- Consumes: `useUtilityRows(buildingId,type,period)`·`useSaveMeterReadings`·`useMeterHistory`(T2). `period = ${referenceDate.slice(0,7)}-01`.
- Produces: 없음(화면 동작).

- [ ] **Step 1: 실패 테스트 작성** (`page.test.tsx` — 목 확장 + 계산·저장 케이스)

기존 `vi.mock("@/hooks/reactquery/utilities", …)`를 아래로 교체하고, "미연동 계산…" 테스트를 저장 검증으로 교체. 나머지 기존 케이스는 유지하되 `useUtilityRows` 호출 인자에 period 추가.

```ts
const saveMutate = vi.fn();
vi.mock("@/hooks/reactquery/utilities", () => ({
  useUtilityRows: vi.fn(),
  useMeterHistory: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useSaveMeterReadings: vi.fn(() => ({ mutate: saveMutate, isPending: false })),
  useSaveWaterDiscount: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteWaterDiscount: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));
```

```ts
// 교체: 저장 호출 검증
it("부과 계산은 입력된 당월 지침을 save_meter_readings로 저장한다", () => {
  render(<UtilitiesPage />);
  selectBuilding();
  fireEvent.change(screen.getByLabelText("101호 당월 지침값"), { target: { value: "158" } });
  fireEvent.click(screen.getByRole("button", { name: "부과 계산" }));

  expect(saveMutate).toHaveBeenCalledTimes(1);
  const [payload] = saveMutate.mock.calls[0];
  expect(payload).toMatchObject({
    buildingId: 1, utilityType: "water",
    rows: [{ unit_id: 101, current_reading: "158", manual_charge: "", note: "" }],
  });
  expect(payload.period).toMatch(/^\d{4}-\d{2}-01$/);
});

it("입력된 지침이 없으면 저장하지 않고 안내한다", () => {
  render(<UtilitiesPage />);
  selectBuilding();
  fireEvent.click(screen.getByRole("button", { name: "부과 계산" }));
  expect(saveMutate).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith("입력된 당월 지침이 없습니다.");
});
```

> 기존 "전기 탭…" 테스트의 단언을 `expect(useUtilityRows).toHaveBeenLastCalledWith(1, "electricity", expect.stringMatching(/^\d{4}-\d{2}-01$/))`로 수정. `setupMocks`의 `useUtilityRows` 설정은 유지.

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/utilities/page.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현 — `page.tsx`** (핵심 diff)

`import` 확장:
```ts
import {
  useUtilityRows,
  useSaveMeterReadings,
  type UtilityType,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
```

`period` 파생 + rows 조회 인자 + 뮤테이션 훅 (컴포넌트 본문, `rowsQuery` 부근):
```ts
const period = `${referenceDate.slice(0, 7)}-01`;
const rowsQuery = useUtilityRows(buildingId, utilityType, period);
const saveMeter = useSaveMeterReadings();
```

`calculateCharges` 교체:
```ts
const calculateCharges = () => {
  const payloadRows = activeRows
    .map((row) => ({ row, draft: scopedDrafts[row.unitId] }))
    .filter(({ draft }) => draft.currentReading.trim() !== "")
    .map(({ row, draft }) => ({
      unit_id: row.unitId,
      current_reading: draft.currentReading.trim(),
      manual_charge: draft.manualCharge.trim(),
      note: draft.note.trim(),
    }));
  if (payloadRows.length === 0) {
    toast.error("입력된 당월 지침이 없습니다.");
    return;
  }
  saveMeter.mutate(
    { buildingId: buildingId as number, utilityType, period, rows: payloadRows },
    {
      onSuccess: (res) => toast.success(`${res.saved}개 세대 검침을 저장했습니다.`),
      onError: () => toast.error("검침 저장에 실패했습니다."),
    },
  );
};
```

> `exportLedger`는 그대로 stub 유지. `부과 계산` 버튼 `disabled`는 `saveMeter.isPending` 추가: `disabled={!buildingId || rows.length === 0 || saveMeter.isPending}`.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/utilities/page.test.tsx"` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/utilities/page.tsx" "app/(staff)/staff/utilities/page.test.tsx"
git commit -m "feat(utilities): 부과 계산이 당월 지침을 저장(save_meter_readings)·period를 기준월에서 파생" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 그룹 3 — 할인 · 이력

### Task 4: `UtilityHistoryModal` 실 6개월 이력

**Files:**
- Modify: `app/(staff)/staff/utilities/components/UtilityHistoryModal.tsx`
- Create: `app/(staff)/staff/utilities/components/UtilityHistoryModal.test.tsx`

**Interfaces:**
- Consumes: `useMeterHistory(unitId,type,period)`·`MeterHistoryRow`(T2).
- Produces: 없음.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/utilities", () => ({ useMeterHistory: vi.fn() }));
import { useMeterHistory } from "@/hooks/reactquery/utilities";
import { UtilityHistoryModal } from "./UtilityHistoryModal";

const row = { unitId: 101, unitNo: "101호", tenantName: "홍길동" } as never;

describe("UtilityHistoryModal", () => {
  it("meter_readings 이력의 부과액·전월 대비 증감을 표시한다", () => {
    vi.mocked(useMeterHistory).mockReturnValue({
      data: [
        { period: "2026-08-01", charge: 12000, unitPrice: null },
        { period: "2026-07-01", charge: 9000, unitPrice: null },
      ],
      isLoading: false, error: null,
    } as never);

    render(
      <UtilityHistoryModal open row={row} utilityType="water" referenceDate="2026-08-15" onClose={() => {}} />,
    );

    expect(screen.getByText("101호 수도 6개월 이력")).toBeInTheDocument();
    expect(screen.getByText("12,000")).toBeInTheDocument();  // 당월 부과액
    expect(screen.getByText("+3,000")).toBeInTheDocument();   // 전월(9,000) 대비 증감
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/utilities/components/UtilityHistoryModal.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현 — `UtilityHistoryModal.tsx` 전체 교체**

```tsx
import { Button, Modal } from "@/components/common";
import { useMeterHistory, type UtilityType, type UtilityUnitRow } from "@/hooks/reactquery/utilities";

const TYPE_LABELS: Record<UtilityType, string> = { water: "수도", electricity: "전기", gas: "가스" };

interface UtilityHistoryModalProps {
  open: boolean;
  row: UtilityUnitRow | null;
  utilityType: UtilityType;
  referenceDate: string;
  onClose: () => void;
}

function ym(period: string): string {
  return `${period.slice(0, 4)}.${period.slice(5, 7)}`;
}
function formatCharge(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("ko-KR");
}
function formatDelta(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ko-KR")}`;
}

export function UtilityHistoryModal({
  open, row, utilityType, referenceDate, onClose,
}: UtilityHistoryModalProps) {
  const period = `${referenceDate.slice(0, 7)}-01`;
  const historyQuery = useMeterHistory(row?.unitId ?? null, utilityType, period);
  if (!row) return null;

  const history = historyQuery.data ?? [];
  // 최신→과거. 전월 대비 증감 = 현재 charge − 바로 다음(과거) 행 charge.
  const rows = history.map((item, index) => {
    const prev = history[index + 1];
    const delta =
      item.charge !== null && prev && prev.charge !== null ? item.charge - prev.charge : null;
    return { ...item, delta };
  });

  return (
    <Modal open={open} onClose={onClose} title={`${row.unitNo} ${TYPE_LABELS[utilityType]} 6개월 이력`}>
      <p className="mb-4 text-sm text-t3">{row.tenantName || "입주자 없음"} · 최근 6개월</p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line bg-bg text-xs font-bold text-t3">
              <th className="px-3 py-3 text-left">월</th>
              <th className="px-3 py-3 text-right">부과액</th>
              <th className="px-3 py-3 text-right">전월 대비 증감</th>
              <th className="px-3 py-3 text-right">단가</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-t4">검침 이력이 없습니다.</td></tr>
            )}
            {rows.map((item) => (
              <tr key={item.period} className="border-b border-line2 last:border-b-0">
                <td className="num px-3 py-3 font-semibold">{ym(item.period)}</td>
                <td className="num px-3 py-3 text-right text-t1">{formatCharge(item.charge)}</td>
                <td className="num px-3 py-3 text-right text-t3">{formatDelta(item.delta)}</td>
                <td className="num px-3 py-3 text-right text-t3">{item.unitPrice === null ? "—" : item.unitPrice.toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-t4">단가·자동요금은 단가 연동 후 표시됩니다.</p>
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>닫기</Button>
      </div>
    </Modal>
  );
}
```

> 단가 미도입이라 기존 "단가 증감" 컬럼은 제거(4컬럼). `page.test.tsx`의 이력 오픈 테스트가 "단가 증감" 텍스트를 단언하면 Task 3 범위에서 함께 수정(해당 단언 삭제). 실제 현재 테스트는 "전월 대비 증감"·"단가 증감"을 확인 — Task 3 Step 1에서 "단가 증감" 단언을 제거하도록 반영.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/utilities/components/UtilityHistoryModal.test.tsx"` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/utilities/components/UtilityHistoryModal.tsx" "app/(staff)/staff/utilities/components/UtilityHistoryModal.test.tsx"
git commit -m "feat(utilities): 6개월 이력을 meter_readings 실데이터로 표시(부과액·전월대비 증감)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `WaterDiscountModal` + 테이블 뱃지 + page 배선

**Files:**
- Create: `app/(staff)/staff/utilities/components/WaterDiscountModal.tsx`
- Create: `app/(staff)/staff/utilities/components/WaterDiscountModal.test.tsx`
- Modify: `app/(staff)/staff/utilities/components/UtilityTable.tsx` (할인 뱃지)
- Modify: `app/(staff)/staff/utilities/page.tsx` (수도 탭 할인 버튼 + 모달)

**Interfaces:**
- Consumes: `useSaveWaterDiscount`·`useDeleteWaterDiscount`(T2), `UtilityUnitRow`(discountType·discountAmount).
- Produces: `WaterDiscountModal` 컴포넌트.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMutate = vi.fn();
const deleteMutate = vi.fn();
vi.mock("@/hooks/reactquery/utilities", () => ({
  useSaveWaterDiscount: () => ({ mutate: saveMutate, isPending: false }),
  useDeleteWaterDiscount: () => ({ mutate: deleteMutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { WaterDiscountModal } from "./WaterDiscountModal";

const row = { unitId: 101, unitNo: "101호", tenantName: "김수급", discountType: null, discountAmount: null } as never;

beforeEach(() => vi.clearAllMocks());

describe("WaterDiscountModal", () => {
  it("구분·금액을 입력해 저장하면 saveWaterDiscount를 호출한다", () => {
    render(<WaterDiscountModal open row={row} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("할인 구분"), { target: { value: "recipient" } });
    fireEvent.change(screen.getByLabelText("할인 금액"), { target: { value: "3000" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ unitId: 101, discountType: "recipient", amount: 3000 }),
      expect.anything(),
    );
  });

  it("기존 할인 세대에서 해제하면 deleteWaterDiscount를 호출한다", () => {
    const withDiscount = { ...row, discountType: "recipient", discountAmount: 3000 } as never;
    render(<WaterDiscountModal open row={withDiscount} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "할인 해제" }));
    expect(deleteMutate).toHaveBeenCalledWith(101, expect.anything());
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/utilities/components/WaterDiscountModal.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현 — `WaterDiscountModal.tsx`**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Button, Modal, Select } from "@/components/common";
import {
  useSaveWaterDiscount, useDeleteWaterDiscount,
  type UtilityUnitRow, type WaterDiscountType,
} from "@/hooks/reactquery/utilities";

const TYPE_OPTIONS: { value: WaterDiscountType; label: string }[] = [
  { value: "recipient", label: "수급자" },
  { value: "multichild", label: "다자녀" },
  { value: "other", label: "기타" },
];

interface WaterDiscountModalProps {
  open: boolean;
  row: UtilityUnitRow | null;
  onClose: () => void;
}

export function WaterDiscountModal({ open, row, onClose }: WaterDiscountModalProps) {
  const saveDiscount = useSaveWaterDiscount();
  const deleteDiscount = useDeleteWaterDiscount();
  const [discountType, setDiscountType] = useState<WaterDiscountType>(
    (row?.discountType as WaterDiscountType) ?? "recipient",
  );
  const [amount, setAmount] = useState(row?.discountAmount != null ? String(row.discountAmount) : "");
  if (!row) return null;

  const hasDiscount = row.discountType !== null;

  const submit = () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("할인 금액을 확인해 주세요.");
      return;
    }
    saveDiscount.mutate(
      { unitId: row.unitId, discountType, amount: parsed },
      { onSuccess: () => { toast.success("할인을 저장했습니다."); onClose(); },
        onError: () => toast.error("할인 저장에 실패했습니다.") },
    );
  };

  const remove = () => {
    deleteDiscount.mutate(row.unitId, {
      onSuccess: () => { toast.success("할인을 해제했습니다."); onClose(); },
      onError: () => toast.error("할인 해제에 실패했습니다."),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={`${row.unitNo} 수도 할인 설정`}>
      <p className="mb-4 text-sm text-t3">{row.tenantName || "입주자 없음"} · 수급자·다자녀 할인</p>
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-t2">할인 구분</span>
          <Select
            aria-label="할인 구분"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as WaterDiscountType)}
            options={TYPE_OPTIONS}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-t2">할인 금액</span>
          <input
            aria-label="할인 금액"
            type="number" min="0" step="1" value={amount} placeholder="원"
            onChange={(e) => setAmount(e.target.value)}
            className="num h-11 w-full rounded-xl border border-line bg-surface px-3 text-right text-sm font-bold text-t1 focus:border-blue focus:outline-none"
          />
        </label>
        <p className="text-xs text-t4">
          할인은 검침 저장 시 이력에 기록되며, 자동요금(단가) 연동 후 요금에서 차감됩니다.
        </p>
      </div>
      <div className="mt-6 flex justify-between">
        <div>
          {hasDiscount && (
            <Button variant="danger" onClick={remove} disabled={deleteDiscount.isPending}>할인 해제</Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={submit} disabled={saveDiscount.isPending}>저장</Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/utilities/components/WaterDiscountModal.test.tsx"` · Expected: PASS.

- [ ] **Step 5: 구현 — `UtilityTable.tsx` 할인 뱃지** (입주자명 셀 뱃지 옆)

`isNew` 뱃지 블록 뒤에 추가:
```tsx
{row.discountType && row.discountAmount != null && (
  <span className="rounded-md bg-blue-t px-2 py-0.5 text-[11px] font-bold text-blue-d">
    {row.discountType === "recipient" ? "수급자" : row.discountType === "multichild" ? "다자녀" : "할인"}
    {" "}−{row.discountAmount.toLocaleString("ko-KR")}
  </span>
)}
```

- [ ] **Step 6: 구현 — `page.tsx` 수도 탭 할인 버튼 + 모달**

`import`에 추가:
```tsx
import { WaterDiscountModal } from "./components/WaterDiscountModal";
```
상태 추가(다른 useState 부근):
```tsx
const [discountRow, setDiscountRow] = useState<UtilityUnitRow | null>(null);
```
상단 액션 버튼 영역(`부과 계산` 버튼 앞)에 수도 탭 한정 버튼:
```tsx
{utilityType === "water" && (
  <Button
    variant="ghost"
    onClick={() => setDiscountRow(activeRows[0] ?? rows[0] ?? null)}
    disabled={!buildingId || rows.length === 0}
  >
    수도 할인 설정
  </Button>
)}
```

> 행에서 직접 진입도 지원: `UtilityTable`은 이미 `onRowClick`으로 이력을 연다. 할인은 상단 버튼(대상=목록 첫 세대 기본, 모달 내 세대 전환 없이 단일 세대) — MVP는 상단 버튼 + 행 클릭=이력 유지. (세대별 진입 개선은 후속.)

모달 렌더(파일 하단 `UtilityHistoryModal` 옆):
```tsx
<WaterDiscountModal
  open={discountRow !== null}
  row={discountRow}
  onClose={() => setDiscountRow(null)}
/>
```

- [ ] **Step 7: page 목 보강 확인** — Task 3에서 `useSaveWaterDiscount`·`useDeleteWaterDiscount`를 이미 목킹했으므로 page.test 통과 유지. Run: `npx vitest run "app/(staff)/staff/utilities/page.test.tsx"` · Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add "app/(staff)/staff/utilities/components/WaterDiscountModal.tsx" "app/(staff)/staff/utilities/components/WaterDiscountModal.test.tsx" "app/(staff)/staff/utilities/components/UtilityTable.tsx" "app/(staff)/staff/utilities/page.tsx"
git commit -m "feat(utilities): 수도 할인 설정 모달·테이블 할인 뱃지(water_discounts)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 전체 검증 + WBS 동기화

**Files:** (없음 — 검증·동기화)

- [ ] **Step 1: 전체 테스트**

Run: `npm test` · Expected: 전체 PASS(P3b 기준 277 + 신규 utilities 케이스).

- [ ] **Step 2: 타입·린트**

Run: `npx tsc --noEmit` · Expected: 0 error.
Run: `npm run lint` · Expected: 신규/수정 파일 error 0(기존 warn 수준 유지).

- [ ] **Step 3: verify SQL 정적 대조**

`supabase/verify/p5a_checks.sql`를 spec §3~§5와 대조(테이블·정책명·RPC 시그니처 일치). 라이브 실행은 사용자 PC.

- [ ] **Step 4: WBS 동기화**

`wbs-commit-sync` 스킬 호출(주택관리ERP 버킷, dev 트랙만, `완료` 자동변경 금지). 대상 화면: **공과금 데이터 `/staff/utilities`**. 비고: "meter_readings·water_discounts 연동, 검침 저장·사용량 계산·6개월 이력·수도 할인(단가/자동요금·부과확정 후속)".

- [ ] **Step 5: 최종 커밋(필요 시)**

문서/WBS 반영 외 코드 변경이 없으면 생략. 있으면:
```bash
git add -A
git commit -m "chore(utilities): P5a 검침 슬라이스 마무리(검증·WBS)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §3 스키마(meter_readings·water_discounts·트리거) → Task 1. ✅
- §4 RPC(list_utility_rows·save_meter_readings) → Task 1. ✅
- §5 RLS(utilities) → Task 1. ✅
- §6 데이터층(apis·keys·queries·mutations, dbUtility, discount 필드, listMeterHistory) → Task 2. ✅
- §7 page(period·calc 저장), WaterDiscountModal, UtilityTable 뱃지, UtilityHistoryModal 실데이터 → Task 3·4·5. ✅
- §8 테스트(apis 재작성·page 갱신·모달 신규·verify SQL) → Task 1~6. ✅
- §9 마이그레이션/적용 순서 → Global Constraints + Task 1. ✅
- Out of scope(단가·billing_confirmations·exportLedger) → Global Constraints에 명시, mutations TODO(p3a) 유지. ✅

**Placeholder scan:** `unit_price`·`calc_charge`는 의도된 null 자리(spec 결정 §2), 코드에 TBD/TODO(구현대상) 없음. `TODO(p3a)` 주석은 후속 스코프 표식으로 유지(의도). ✅

**Type consistency:** `dbUtility`(electricity→elec) T2 정의 → T2·T4에서 동일 사용. `UtilityUnitRow.discountType/discountAmount` T2 정의 → T4·T5 소비 일치. `SaveMeterReadingsInput.rows`(unit_id·current_reading·manual_charge·note: string) T2 ↔ page payload(T3) ↔ RPC p_rows(T1) 일치. `MeterHistoryRow{period,charge,unitPrice}` T2 ↔ 모달(T4) 일치. `WaterDiscountType` T2 ↔ 모달(T5) 일치. ✅

> **주의(구현 중 확인):** ① `UtilityHistoryModal` 4컬럼화로 기존 `page.test.tsx`의 "단가 증감" 단언 제거는 **Task 3 Step 1**에 포함. ② `page.test.tsx` 유틸 목은 **Task 3에서 5개 훅 전부** 등록(이후 태스크에서 렌더되는 모달이 참조). ③ Supabase RETURNS TABLE의 `usage`는 비예약어라 허용.
