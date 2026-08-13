# 관리비서 — P5a 검침·지침(`/staff/utilities`) 설계 (spec)

- **작성일:** 2026-08-12
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth) + React Query + TailwindCSS
- **기준 정본:** `docs/superpowers/specs/2026-08-10-prd-synthesis.md` §E, `docs/prototype/prd/utility-charge.md`
- **로드맵:** `docs/superpowers/plans/2026-08-10-roadmap.md` — 로드맵 **P5(검침·부과·고지서)** 중 `/staff/utilities` **검침 슬라이스**(`meter_readings`·`water_discounts`)만. `/management-fee`·`/bill`·부과확정은 후속.
- **선행:** P0, P1a(`units`), P2a(`current_user_org`·`current_user_has_module`), P3b(`unit_meters`·`occupancies` 확장).

---

## 0. 배경 & 위치

`/staff/utilities` UI는 이미 스캐폴딩 완료(page·`UtilityTable`·`UtilitySummaryCards`·`UtilityHistoryModal`). 검침 데이터가 없어 모든 지침·요금·이력 셀이 하드코딩 `null`이고, `부과 계산`·`검침대장 다운`은 토스트만 띄운다. 이 슬라이스는 그 위의 **`TODO(meter)`·`TODO(p3a)`** 를 실데이터로 채운다.

핵심 모델: **호실(unit) → 유형(water/elec/gas) → 월(period)별 지침(meter_readings)**. `부과 계산` = 당월 지침 저장 + 사용량(당월−전월) 서버 계산. 고객/계량기번호는 P3b가 신설한 `unit_meters`에서 가져온다. 수도 할인(`water_discounts`)은 이 화면에서 설정·표시하고, 계산 시 스냅샷으로 기록한다.

> **중요(스캐폴딩 stale)**: 현재 `apis.ts`는 `units.elec_customer_no`·`elec_meter_no`·`water_customer_no`를 읽는데, **P3b(0006)가 이 컬럼을 제거하고 `unit_meters`로 이관**했다. 이 슬라이스에서 `unit_meters` join으로 근본 교정한다.

---

## 1. 목표 & 범위

**In scope**
- **DB(`0007`)**: `meter_readings`(세대·유형·월별 지침 이력)·`water_discounts`(세대 수도 할인) + `utilities` module RLS + RPC `list_utility_rows`(조회)·`save_meter_readings`(원자적 저장).
- **데이터층 개편**: `apis.ts`를 stale `units` 컬럼 → `list_utility_rows` RPC로 재작성(`electricity ⇄ elec` 매핑), `mutations.ts`에 `useSaveMeterReadings`·`useSaveWaterDiscount`·`useDeleteWaterDiscount`, `useMeterHistory` 조회 추가, 키에 `period` 포함.
- **UI**: `page.tsx` `calculateCharges()` → 실제 저장, `period`를 `referenceDate` 월에서 파생. **신규 `WaterDiscountModal`**(수도 탭 세대 할인 설정) + 테이블 할인 뱃지. `UtilityHistoryModal` null 셀 → 실 6개월 이력.
- 테스트(vitest+RTL) 갱신·신규 + 검증 SQL(`p5a_checks.sql`).

**Out of scope (후속)**
- **단가·자동요금 계산** → 단가 값 출처가 DB에 없음(사용자 확정). `meter_readings.unit_price`·`calc_charge`는 **컬럼 자리만(null)**. 자동요금·`요금=사용량×단가−할인` 자동 차감은 단가 도입 시.
- **부과 확정 원장 `billing_confirmations`** → P5 `/management-fee`(billing 모듈). `mutations.ts`의 `TODO(p3a)` 주석 유지.
- **검침대장 엑셀 다운(`exportLedger`)** → 서버 xlsx 생성(별건). 현행 stub 유지.
- **층별·고객번호별 분리 단가**, **상가 고정 사용량** → 단가 도입 시 후속.
- **가스 고객/계량기번호** → `unit_meters`에 데이터 있으면 자동 노출(스키마는 이미 지원). 없으면 '미등록'.

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | 슬라이스 범위 | `/utilities` **검침만**(meter_readings·water_discounts). management-fee·bill·부과확정 제외 | WBS 행 · 사용자 확정 |
| 2 | 요금 계산 | **지침·사용량 저장까지**. 단가·자동요금 미도입(컬럼 자리만 null) | 사용자 확정 · 단가 출처 부재 |
| 3 | 수도 할인 | **`water_discounts` 신설 + 이 화면 설정 모달** 포함. 계산 시 `meter_readings.discount_amount` 스냅샷 | 사용자 확정 |
| 4 | 할인 적용 방식 | 등록·표시(뱃지)·이력 스냅샷까지. **수동요금 자동 차감은 안 함**(자동요금 없음) | 사용자 확정(§D) · 자동 차감은 단가 도입 시 |
| A | 조회 | **RPC `list_utility_rows(building, utility, period)`** — units+occupancy+unit_meters+당월/전월 meter_readings+water_discounts 조인 1회 | `list_tenants` 선례 · stale 컬럼 근본 교정 · 전월 지침 월계산 서버화 |
| B | 저장 | **RPC `save_meter_readings`(원자적)** — 전월 lookup·usage 계산·할인 스냅샷·`processed_at` 기록 | `save_unit_occupancy` 선례 · 부분저장 방지 |
| C | 할인 저장 | 단일행 → **RLS 게이팅 upsert/delete**(RPC 없음), `unique(unit_id)` | 단순 config · 소프트삭제 불필요(스냅샷이 이력 보존) |
| D | 유형 표기 | DB `water/elec/gas`(unit_meters 정합), UI `water/electricity/gas` → `dbUtility()` 매핑 | 0006 `unit_meters` check 제약 계승 |
| E | 부과 월(period) | `date`(월1일 정규화), 화면 `referenceDate`의 연·월에서 파생 | 별도 월 선택 UI 불필요 · 기존 표시가 이미 그 월 |
| F | RLS 게이트 | 신규 2테이블 쓰기 = **`current_user_has_module('utilities')`**, SELECT org 개방 | P3b 자식테이블 패턴 · 현장직원 쓰기 차단 |
| G | 금액·지침 타입 | 지침·사용량·단가 `numeric(12,2)`, 요금·할인 `integer`(원) | 로드맵 "금액 정수" · 수도 지침 소수 허용 |

---

## 3. DB 스키마 — `supabase/migrations/0007_p5a_utilities.sql`

> P1a(`units`), P2a(`current_user_org`·`current_user_has_module`·`my_org_ids`·`set_updated_at`), P3b(`unit_meters`·`occupancies` 확장, `occupancy_status`)에 의존. 단일 파일.

### 3.1 `meter_readings` (세대·유형·월별 지침 이력)

```sql
create table meter_readings (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  utility text not null check (utility in ('water','elec','gas')),
  period  date not null,                 -- 월1일 정규화(예: 2026-08-01)
  previous_reading numeric(12,2),        -- 전월 지침(저장 시점 동결)
  current_reading  numeric(12,2),        -- 당월 지침
  usage            numeric(12,2),        -- 당월−전월(서버 계산)
  unit_price       numeric(12,2),        -- 단가: 미도입(null 자리)
  calc_charge      integer,              -- 자동요금: 미도입(null 자리)
  discount_amount  integer,              -- 계산 시 water_discounts 스냅샷
  manual_charge    integer,              -- 수동 입력 요금
  note             text,                 -- 적요
  processed_at     timestamptz,          -- 부과 처리일(계산 실행 시각)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, utility, period)
);
create index on meter_readings (unit_id, utility, period desc);
```

### 3.2 `water_discounts` (세대 수도 할인 — config, 하드삭제)

```sql
create table water_discounts (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  discount_type text not null check (discount_type in ('recipient','multichild','other')),
  amount integer not null default 0,     -- 원 단위 할인액
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id)                       -- 세대당 1건, 해제=삭제(스냅샷이 이력 보존)
);
create index on water_discounts (unit_id);
```

### 3.3 트리거

```sql
do $$ declare t text; begin
  foreach t in array array['meter_readings','water_discounts'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;
```

---

## 4. RPC

### 4.1 `list_utility_rows` (definer, stable)

```sql
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
```
- 전월 지침: 당월 행이 있으면 동결값 `cur.previous_reading`, 없으면 전월 행 `prev.current_reading`.
- 할인은 `p_utility='water'`일 때만 join(전기·가스는 null).

### 4.2 `save_meter_readings` (원자적)

```sql
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

---

## 5. RLS — `utilities` module (P3b 자식테이블 패턴 계승)

```sql
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
```
- `save_meter_readings`·`list_utility_rows`는 definer이나 내부 `current_user_org()`/`current_user_has_module('utilities')` 명시 검증.

---

## 6. 데이터 계층 (`hooks/reactquery/utilities/`)

- **`apis.ts` 재작성**: `listUtilityRows(buildingId, utilityType, period)` → `.rpc("list_utility_rows", {p_building_id, p_utility: dbUtility(type), p_period})`. snake→camel 매퍼. `UtilityUnitRow`에 `discountType`·`discountAmount` 추가(기존 필드 유지, `automaticCharge=calc_charge` null). `dbUtility(type)` 헬퍼(`electricity→elec`). `saveMeterReadings(input)`·`saveWaterDiscount(input)`·`deleteWaterDiscount(unitId)`·`listMeterHistory(unitId, utilityType, period)`(meter_readings 직접 조회, RLS select).
- **`keys.ts`**: `rows(buildingId, type, period)`·`history(unitId, type, period)`.
- **`queries.ts`**: `useUtilityRows(buildingId, type, period)`·`useMeterHistory(unitId, type, period)`.
- **`mutations.ts`**: `useSaveMeterReadings`·`useSaveWaterDiscount`·`useDeleteWaterDiscount` — 성공 시 `utilityKeys.all` 무효화. `TODO(p3a)` 부과확정 주석 유지.

---

## 7. 페이지 & 컴포넌트

- **`page.tsx`**: `period = ${referenceDate.slice(0,7)}-01` 파생 → `useUtilityRows(buildingId, utilityType, period)`. `calculateCharges()` → activeRows 초안을 `[{unit_id, current_reading, manual_charge, note}]`로 만들어 `useSaveMeterReadings` 호출, 성공 "검침 저장 완료"·실패 토스트. `exportLedger` stub 유지. 수도 탭에서 **할인 설정** 버튼 노출 → `WaterDiscountModal`. 전월지침·사용량·처리일은 이제 실데이터로 흐름.
- **신규 `components/WaterDiscountModal.tsx`**: 세대 선택(또는 행에서 진입) + 구분(수급자/다자녀/기타)·금액·메모 입력 → `useSaveWaterDiscount`/`useDeleteWaterDiscount`. 저장 시 rows 무효화로 뱃지 갱신.
- **`components/UtilityTable.tsx`**: 수도 탭 할인 세대에 뱃지(`수급자 −3,000` 등, `discountType`·`discountAmount`). 기존 컬럼·공실·신규강조 로직 유지.
- **`components/UtilityHistoryModal.tsx`**: `useMeterHistory`로 최근 6개월 `meter_readings` → 부과액(manual_charge, 단가 도입 시 calc_charge)·전월 대비 증감 계산. 단가/단가증감은 단가 도입 전 '—'.

> **Next 주의(AGENTS.md)**: 클라이언트 훅·`use client` 페이지 시그니처 변경 없음(기존 패턴 유지). 신규 라우트 없음.

---

## 8. 테스트 전략 (TDD)

- **단위(Vitest)**: `apis.test.ts` **재작성** — `.rpc("list_utility_rows")` 목, snake→camel 매핑, `dbUtility` (`electricity→elec`) 검증, `saveMeterReadings` payload, `listMeterHistory` 매핑. `mutations` 무효화.
- **컴포넌트(RTL)**: `page.test.tsx` 갱신 — `useSaveMeterReadings`·`useMeterHistory`·`useSaveWaterDiscount` 목. 기존 통과 케이스(권한·초기안내·행표시·공실비활성·탭전환·이력오픈) 유지. 신규: `부과 계산`→저장 payload, 할인 모달 저장, 이력 실데이터. `WaterDiscountModal`·`UtilityTable` 뱃지.
- **RLS·RPC(SQL, `supabase/verify/p5a_checks.sql`)**: `utilities` 없는 구성원 meter_readings/water_discounts **SELECT 가능·쓰기 거부**; 보유·마스터 가능. `save_meter_readings` usage=당월−전월·할인 스냅샷·타 org 호실 거부. `list_utility_rows` 전월 join·할인 water 한정. 타 org 격리.
- **정적**: `tsc --noEmit` + `npm run lint`.
- **라이브 미적용**: 원격 미접속 → vitest+tsc+verify SQL 정적. 적용·E2E는 사용자 PC(순서 …0006→0007).

---

## 9. 마이그레이션 / 환경

- `supabase/migrations/0007_p5a_utilities.sql`(§3·§4·§5) + `supabase/verify/p5a_checks.sql`.
- 신규 env 없음.
- 적용(사용자): `0007` 실행 → `p5a_checks.sql`. **DB pending-user**, 순서 …0003→0004→0005→0006→**0007**. 스캐폴딩이 이미 0006 기준이므로 **0006 미적용 시 이 화면은 0006까지 함께 적용해야 동작**.

---

## 10. plan 단계화 (단일 plan, 3그룹)

1. **그룹1 — DB·데이터층**: `0007`(meter_readings·water_discounts·RLS·`list_utility_rows`·`save_meter_readings`) + `p5a_checks.sql` → `apis.ts` 재작성(RPC·`dbUtility`·매퍼·discount 필드) + `keys`/`queries`/`mutations` + `apis.test.ts` 재작성.
2. **그룹2 — 저장·계산 플로우**: `page.tsx` `calculateCharges` 실저장 + `period` 파생 + 요약/테이블 실데이터 흐름 + `page.test.tsx` 계산·저장 케이스.
3. **그룹3 — 할인·이력**: `WaterDiscountModal` + 테이블 뱃지 + `UtilityHistoryModal` 실데이터 + 관련 테스트.

---

## 11. 열린 항목 / 향후

- **단가·자동요금** — 단가 출처(층별·고객번호별) 확정 시 `unit_price`·`calc_charge` 채우고 `요금=사용량×단가−할인` 자동화. 컬럼은 이미 존재.
- **부과 확정 원장** `billing_confirmations` → P5 `/management-fee`.
- **검침대장 엑셀** `exportLedger` → 서버 xlsx(별건).
- **상가 고정 사용량**·**할인 자동 차감** → 단가 도입 시.
- **할인 설정 위치** — 현재 utilities 모달. 추후 입주자 상세로 이관/동기화 가능(테이블은 unit_id 기준이라 무관).

---

## 부록. TODO → P5a 배치

| 현재 TODO | 배치 |
|---|---|
| `apis.ts:71` TODO(p3a) 고객번호 | `list_utility_rows` → `unit_meters.customer_no` |
| `apis.ts:81` TODO(p3a) 계량기번호 | `list_utility_rows` → `unit_meters.meter_no` |
| `apis.ts:102` TODO(meter) 검침값·요금·처리일 | `list_utility_rows` → `meter_readings` 조인 |
| `mutations.ts:1` TODO(meter) 검침 저장 | `useSaveMeterReadings` → `save_meter_readings` |
| `mutations.ts:2` TODO(p3a) 부과확정 | **유지**(P5 billing) |
| `page.tsx:120` TODO(meter) 저장·계산 | `calculateCharges` → 저장 + 서버 usage |
| `page.tsx:121` TODO(p3a) 할인·고정·층별·확정 | 할인=`water_discounts`(모달), 고정·층별·확정=후속 |
| `UtilityHistoryModal:38` TODO(meter) 이력 | `useMeterHistory` → `meter_readings` |
