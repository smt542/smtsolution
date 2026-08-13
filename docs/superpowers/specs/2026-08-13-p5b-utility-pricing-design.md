# 관리비서 — P5b 공과금 단가·자동요금·부과확정·검침대장(`/staff/utilities`) 설계 (spec)

- **작성일:** 2026-08-13
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth) + React Query + TailwindCSS + 기존 `lib/export/xlsx`(`rowsToXlsxBuffer`) 재사용
- **기준 정본:** `docs/prototype/prd/utility-charge.md`, `docs/superpowers/specs/2026-08-12-p5a-utilities-meter-design.md`(§11 열린 항목)
- **로드맵:** P5(검침·부과·고지서) 중 `/staff/utilities`의 **후속 슬라이스** — P5a(검침·지침)가 남긴 `단가·자동요금·부과확정·검침대장 엑셀`을 채운다.
- **선행:** P0(`profiles`·`audit_log`·`set_updated_at`), P2a(`current_user_org`·`current_user_has_module`·`my_org_ids`), P3a(`building_customer_numbers`), P3b(`unit_meters`·`occupancies`), P5a(`meter_readings`·`water_discounts`·`list_utility_rows`·`save_meter_readings`), P5(`round_charge` — `0012`).
- **브랜치:** `PracLee/tarpon`(base `master`).

---

## 0. 배경 & 위치

P5a에서 `/staff/utilities`의 **검침 슬라이스**(세대·유형·월별 지침 저장, 사용량 서버계산, 수도 할인 스냅샷)가 완료됐다. 그때 명시적으로 **후속으로 미룬 것**이 이 슬라이스다(P5a spec §1 Out of scope, §11):

- `meter_readings.unit_price`·`calc_charge`는 **컬럼 자리만(null)** — `부과 계산` 버튼은 지침을 저장할 뿐 **요금을 계산하지 않는다**.
- 단가 값을 둘 곳이 DB·PRD 어디에도 없다(P5a에서 "사용자 확정"으로 표시).
- `exportLedger`는 토스트만 띄우는 stub.
- 부과확정(잠금) 없음.

이 슬라이스는 그 넷을 채운다: **① 고객번호별 단가 설정 → ② 자동요금 계산(사용량×단가−할인) → ③ 공과금 자체 부과확정(잠금) → ④ 검침대장 엑셀(서버 생성)**.

핵심 사용자 결정(2026-08-13):
- **단가 단위 = 고객번호별**(PRD "고객번호별 층별 단가"에 충실). 이미 있는 `building_customer_numbers`(건물별 수도/공용전기/전기/가스 고객번호, 상가용·주택용 복수)에 단가를 1:1로 붙인다.
- **부과확정 = 공과금 자체 확정**(건물×유형×월 잠금 원장). 관리비(`/management-fee`) 통합은 후속.
- **상가 고정 사용량 = 후속.**

---

## 1. 목표 & 범위

**In scope**
- **DB(`0014_p5b_utility_pricing.sql`)**
  - `utility_unit_prices`(고객번호별 단가, 1:1)
  - `utility_confirmations`(건물×유형×월 부과확정 잠금)
  - RPC: `list_utility_prices`(단가 설정 조회)·`save_utility_unit_prices`(원자적 저장)·`confirm_utilities`(부과확정)·`list_utility_confirmation`(확정상태·is_dirty)
  - `list_utility_rows` **확장**(세대별 `resolved_unit_price` 노출) + `save_meter_readings` **확장**(단가 해석·`calc_charge` 계산·스냅샷)
  - RLS(신규 2테이블, `utilities` 모듈 쓰기 게이트) + `supabase/verify/p5b_checks.sql`
- **데이터층**(`hooks/reactquery/utilities/`): `listUtilityPrices`·`saveUtilityUnitPrices`·`confirmUtilities`·`getUtilityConfirmation`·`ledgerDownloadUrl` + keys/queries/mutations + 테스트.
- **UI**(`/staff/utilities`): `단가 설정` 모달(신규 `UnitPriceModal`), `부과 확정` 플로우(확인 팝업·확정 배지·is_dirty 경고), `자동요금`·`단가` 컬럼 실데이터, `검침대장 다운` 실제 다운로드.
- **검침대장 엑셀**: 서버 Route Handler(`app/api/utilities/ledger/route.ts`, 기존 `app/api/buildings/export/route.ts` 패턴) + 기존 `lib/export/xlsx.rowsToXlsxBuffer` 재사용.
- 테스트(vitest+RTL) + 정적(tsc·lint).

**Out of scope (후속)**
- **상가 고정 사용량**(계량기 없는 상가 세대 월 고정 톤수) — 세대별 설정 UI 별도 필요.
- **관리비 통합 확정** — `calc_charge`를 `/management-fee`의 `fee_item_charges`로 밀어넣는 통합. 이번은 공과금 자체 확정까지.
- **공용전기(`common_elec`) 안분** — 세대 계량이 아니라 공용 배분 로직. 단가 대상은 `water/elec/gas`만.
- **수납/고지서 연계** — 확정된 공과금의 수납(Task 2)·고지서 반영은 별건.
- **단가 기간 버전(effective_period)** — 단가는 "현재값" 1건, 이력은 `meter_readings.unit_price` 스냅샷이 보존.

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | 단가 단위 | **고객번호별**(`utility_unit_prices` ↔ `building_customer_numbers` 1:1) | 사용자 확정 · PRD "고객번호별 층별 단가" · 기존 복수 고객번호 인프라 |
| 2 | 단가 소유 | **utilities 모듈 소유 신규 테이블**. `building_customer_numbers`(P3a) 컬럼 미변경 | 도메인 결합 최소화 · P3a 테이블 불변 |
| 3 | 단가 이력 | 단가는 "현재값" 1건. 이력은 계산 시 `meter_readings.unit_price` **스냅샷**으로 보존 | YAGNI · 6개월 이력 팝업이 스냅샷을 읽음 |
| 4 | 세대→단가 해석 | ① `unit_meters.customer_no` 일치 → ② 유형 고객번호 정확히 1개면 그 단가 → ③ 그 외 null | 상가/주택 분리 + 단일 고객번호 건물 자동 처리 + 안전 폴백 |
| 5 | 요금식 | `calc_charge = greatest(0, round(usage×unit_price) − discount)`; `usage`·`unit_price` null이면 null | PRD "사용량×단가", 할인 자동차감 · `round_charge` 재사용 |
| 6 | 유효요금 | `coalesce(manual_charge, calc_charge)` — 수동요금 우선 | PRD "수동 입력값 우선" · 기존 요약 로직 |
| 7 | 부과확정 | **공과금 자체 확정** `utility_confirmations`(건물×유형×월 잠금·합계·확정자) | 사용자 확정 T1 |
| 8 | 확정 후 편집 | **하드 잠금 없음**. `is_dirty`(확정 후 수정 감지)로 표시 + **재확정** 가능 | `confirm_billing`(0012) 선례 일치 · 정정 허용 |
| 9 | 검침대장 | **서버 Route Handler**(`app/api/utilities/ledger`) + **기존 `rowsToXlsxBuffer` 재사용**(신규 의존성 없음), 파일명 `[건물명]_[유형]_검침대장_YYYYMM.xlsx` | 기존 `buildings/export` 선례 · 한글 파일명 RFC 5987 |
| 10 | 마이그 번호 | `0014`(master 최신 `0013`×2 다음). 신규 2테이블·RPC 확장 단일 파일 | 0013 중복 회피 |
| 11 | 금액·단가 타입 | 단가 `numeric(12,2)`, 요금·할인 `integer`(원), 합계 `bigint` | P5a §2-G 계승 |

---

## 3. DB 스키마 — `supabase/migrations/0014_p5b_utility_pricing.sql`

> P3a(`building_customer_numbers`), P3b(`unit_meters`), P5a(`meter_readings`·`water_discounts`), P2a(`current_user_org`·`current_user_has_module`·`my_org_ids`·`set_updated_at`), P5(`round_charge`), P0(`profiles`·`audit_log`)에 의존. 단일 파일.

### 3.1 `utility_unit_prices` (고객번호별 단가 — config, 1:1)

```sql
create table utility_unit_prices (
  id bigint generated always as identity primary key,
  building_customer_number_id bigint not null
    references building_customer_numbers(id) on delete cascade,
  unit_price numeric(12,2) not null default 0,   -- 원/톤·kWh·m³
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_customer_number_id)           -- 고객번호당 1건
);
create index on utility_unit_prices (building_customer_number_id);
```
- 유형(`kind`)·건물은 `building_customer_numbers`에서 파생. 단가 대상 kind = `water/elec/gas`(공용전기 `common_elec` 제외).

### 3.2 `utility_confirmations` (건물×유형×월 부과확정 잠금)

```sql
create table utility_confirmations (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  utility text not null check (utility in ('water','elec','gas')),
  period date not null check (period = date_trunc('month', period)::date),
  unit_count int not null default 0,
  total_amount bigint not null default 0,
  confirmed_at timestamptz,
  confirmed_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, utility, period)
);
create index on utility_confirmations (building_id, utility, period);
```
- 세대별 요금은 `meter_readings`가 보유(별도 히스토리 테이블 불필요). 확정은 건물×유형×월 단위 잠금·합계.

### 3.3 트리거

```sql
do $$ declare t text; begin
  foreach t in array array['utility_unit_prices','utility_confirmations'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;
```

---

## 4. RLS — `utilities` module (SELECT org 개방 / 쓰기 모듈 게이트)

```sql
alter table utility_unit_prices  enable row level security;
alter table utility_confirmations enable row level security;

-- utility_unit_prices: 고객번호→건물→org 경유
create policy uup_select on utility_unit_prices for select
  using (building_customer_number_id in (
    select bcn.id from building_customer_numbers bcn
    join buildings b on b.id = bcn.building_id
    where b.org_id in (select my_org_ids())));
create policy uup_write on utility_unit_prices for all
  using      (building_customer_number_id in (
    select bcn.id from building_customer_numbers bcn join buildings b on b.id = bcn.building_id
    where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'))
  with check (building_customer_number_id in (
    select bcn.id from building_customer_numbers bcn join buildings b on b.id = bcn.building_id
    where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'));

-- utility_confirmations: 건물→org 경유
create policy uc_select on utility_confirmations for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy uc_write on utility_confirmations for all
  using      (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('utilities'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('utilities'));
```
- 쓰기 RPC는 definer이나 내부에서 `current_user_org()`/`current_user_has_module('utilities')` 명시 검증.

---

## 5. RPC

### 5.1 `list_utility_prices(p_building_id, p_utility)` — 단가 설정 조회 (definer, stable)
반환: `customer_number_id`, `customer_no`, `holder_name`, `sort_order`, `unit_price`(없으면 null). `building_customer_numbers`(kind=`p_utility`) LEFT JOIN `utility_unit_prices`. `order by sort_order, id`.

### 5.2 `save_utility_unit_prices(p_building_id, p_utility, p_prices jsonb)` — 원자적 저장 (definer)
`p_prices = [{customer_number_id, unit_price}]`. 검증: org·`utilities` 모듈, 각 `customer_number_id`가 `p_building_id` 소속이며 `kind = p_utility`. `on conflict (building_customer_number_id) do update`. 반환 `{saved}`.

### 5.3 `list_utility_rows` **확장** (기존 시그니처 유지)
기존 반환에 **`resolved_unit_price numeric`** 1컬럼 추가 — 세대가 계산에 쓸 "현재 단가"(§2-4 해석). 표에서 계산 전 미리보기·단가 컬럼 표시용. 스냅샷된 `unit_price`(계산 완료 행)와 병행.

해석 SQL(세대 `u`, 유형 `k`, 건물 `B`):
```sql
coalesce(
  -- ① customer_no 일치
  (select uup.unit_price
     from unit_meters um
     join building_customer_numbers bcn
       on bcn.building_id = B and bcn.kind = k and bcn.customer_no = um.customer_no
     join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
    where um.unit_id = u.id and um.utility = k),
  -- ② 유형 고객번호(단가설정)가 정확히 1개면 그 단가
  (select max(uup.unit_price)
     from building_customer_numbers bcn
     join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
    where bcn.building_id = B and bcn.kind = k
   having count(*) = 1)             -- 단일행이면 max=그 값, 아니면 no row(→null)
)
```
> 결정성: ②는 `having count(*) = 1`로 "단가설정된 유형 고객번호가 정확히 1건"일 때만 스칼라 반환. 2건 이상(상가/주택 분리)인데 ①이 미매칭이면 `null`(수동요금 처리).

### 5.4 `save_meter_readings` **확장** (기존 시그니처 유지)
기존 저장 로직(전월 lookup·usage·할인 스냅샷·`processed_at`)에 **단가 해석·요금 계산** 추가:
```
v_price := <§2-4 해석 결과>;
v_calc  := case
             when v_usage is not null and v_price is not null
             then greatest(0, round_charge(v_usage * v_price, 'round') - coalesce(v_disc,0))
           end;
-- insert/update에 unit_price = v_price, calc_charge = v_calc 스냅샷
```
- 반환에 `{saved, period, total_calc}` 정도로 확장(요약 토스트용, 선택).

### 5.5 `confirm_utilities(p_building_id, p_utility, p_period)` — 부과확정 (definer)
검증(org·`utilities`·건물·월1일·미래월 금지) 후, **입주 세대**(status ≠ vacant)의 `meter_readings`(해당 building·utility·period) 순회:
- `v_eff := coalesce(manual_charge, calc_charge, 0)`; `total += v_eff`; `count++`.
- `upsert utility_confirmations(building_id, utility, period, unit_count, total_amount, confirmed_at=now(), confirmed_by=auth.uid())`.
- `audit_log(action='UTILITY_CONFIRM', table_name='utility_confirmations', row_pk=building_id, after=jsonb_build_object('utility',p_utility,'period',p_period,'unit_count',v_count,'total',v_total))`.
- 반환 `{unit_count, total}`. **재확정 가능**(확정행 upsert 갱신).

### 5.6 `list_utility_confirmation(p_building_id, p_utility, p_period)` — 확정상태·is_dirty (definer, stable)
0/1행: `confirmed_at`, `confirmed_by_name`(profiles), `unit_count`, `total_amount`, `is_dirty`.
`is_dirty = confirmed_at is not null and (`
- `exists(meter_readings mr join units u … where u.building_id=B and mr.utility=k and mr.period=period and mr.updated_at > uc.confirmed_at)` **또는**
- `exists(utility_unit_prices uup join building_customer_numbers bcn on bcn.id=uup.building_customer_number_id where bcn.building_id=B and bcn.kind=k and uup.updated_at > uc.confirmed_at)` `)`

> 두 번째 항이 핵심: **확정 후 단가만 바꿔도** `is_dirty`가 떠 "재계산→재확정"을 유도(확정 총액이 조용히 stale 되는 것 방지). `confirm_utilities`는 순수 합계(재계산 side-effect 없음)로 두고, 정합성은 `is_dirty`가 담보.

> 모든 RPC `revoke execute … from anon`(및 `public`), definer + `set search_path = public`.

---

## 6. 데이터 계층 (`hooks/reactquery/utilities/`)

- **`apis.ts`**
  - `UtilityUnitRow`에 `resolvedUnitPrice: number | null` 추가(매퍼 갱신).
  - `listUtilityPrices(buildingId, type)` → `list_utility_prices`; `UtilityPriceRow{customerNumberId, customerNo, holderName, unitPrice}`.
  - `saveUtilityUnitPrices({buildingId, type, prices})` → `save_utility_unit_prices`.
  - `confirmUtilities({buildingId, type, period})` → `confirm_utilities`.
  - `getUtilityConfirmation(buildingId, type, period)` → `list_utility_confirmation`(0/1행 → `UtilityConfirmation | null`).
  - `ledgerDownloadUrl(buildingId, type, period)` → Route Handler URL 빌더(쿼리스트링).
- **`keys.ts`**: `prices(buildingId, type)`, `confirmation(buildingId, type, period)`(기존 `rows`·`history` 유지).
- **`queries.ts`**: `useUtilityPrices`, `useUtilityConfirmation`.
- **`mutations.ts`**: `useSaveUtilityUnitPrices`(성공 시 `prices`+`rows` 무효화), `useConfirmUtilities`(성공 시 `confirmation`+`rows` 무효화). `TODO(p3a)` 부과확정 주석 제거.

---

## 7. 페이지 & 컴포넌트

- **`page.tsx`**
  - 상단 액션에 **`단가 설정`** 버튼 추가 → `UnitPriceModal`(현재 건물·현재 탭).
  - **`부과 확정`** 버튼 추가 → 확인 팝업 → `useConfirmUtilities` → 성공/실패 토스트. 확정 배지(확정일·확정자)·`is_dirty` 경고("확정 후 수정됨 — 재확정 필요") 표시(`useUtilityConfirmation`).
  - 기존 `부과 계산`(저장+계산) 유지 — 이제 `calc_charge`·`unit_price` 실값이 흐름. 안내 배너(§P5a "단가 미연동") **제거/수정**.
  - `exportLedger` → `ledgerDownloadUrl`로 실제 다운로드(`window.location`/anchor). 실패 토스트.
- **신규 `components/UnitPriceModal.tsx`**: `useUtilityPrices`로 고객번호 목록+단가 표시, 각 단가 입력 → `useSaveUtilityUnitPrices`. 고객번호 0건이면 "건물 상세에서 고객번호를 먼저 등록" 안내.
- **`components/UtilityTable.tsx`**: `단가`(스냅샷 `unitPrice` else `resolvedUnitPrice`)·`자동요금`(`calc_charge`) 컬럼 실데이터. 할인 뱃지 유지. 확정 잠금 시 시각 표시(선택).
- **`components/UtilitySummaryCards.tsx`**: 예상 부과액을 `coalesce(manual, calc)` 기준으로(기존 로직과 정합).
- **`components/UtilityHistoryModal.tsx`**: `calc_charge`·`unit_price` 실값 → 단가·단가증감 실제 표시(기존 '—' 대체).

> **Next 주의(AGENTS.md)**: 신규 Route Handler는 반드시 `node_modules/next/dist/docs`의 route handler 가이드 확인 후 작성. 클라이언트 훅·`use client` 페이지 시그니처 변경 없음.

---

## 8. 검침대장 엑셀 — Route Handler (기존 `buildings/export` 선례 그대로)

- **경로:** `app/api/utilities/ledger/route.ts` (`GET`), 쿼리 `buildingId`·`utility`·`period`. 기존 `app/api/buildings/export/route.ts`와 동일 컨벤션(`export async function GET(request: Request)`).
- **동작:** `@/lib/supabase/server`의 `createClient()`(세션 쿠키 → RLS)로 `list_utility_rows` 호출 → 컬럼 정의 + row 매핑 → **`rowsToXlsxBuffer(columns, rows)`**(`@/lib/export/xlsx`) → `Response`(`Content-Type: …spreadsheetml.sheet`, `Content-Disposition: attachment; filename="…"; filename*=UTF-8''<encoded>`). 헤더: 호실·입주자·전월지침·당월지침·사용량·단가·자동요금·수동요금·할인·적요·처리일.
- **파일명:** `[건물명]_[유형라벨]_검침대장_YYYYMM.xlsx`(한글 → `encodeURIComponent`, RFC 5987; `buildings/export`의 `filename*` 패턴). 건물명은 `list_utility_rows`에 없으므로 `buildings` 최소 조회 1회 또는 쿼리 파라미터로 전달.
- **권한:** 세션 없음/타 org 건물 → RLS로 빈 결과.
- **의존성:** **없음**(기존 `rowsToXlsxBuffer` 재사용).

---

## 9. 테스트 전략 (TDD)

- **단위(Vitest, `apis.test.ts`)**: `list_utility_prices`/`save_utility_unit_prices`/`confirm_utilities`/`list_utility_confirmation` `.rpc` 목·매핑, `resolvedUnitPrice` 매퍼, `ledgerDownloadUrl` 쿼리스트링, `mutations` 무효화 키.
- **컴포넌트(RTL)**: `page.test.tsx` — `단가 설정` 오픈·저장, `부과 확정` 확인팝업→확정→배지, `is_dirty` 경고, `검침대장 다운`이 URL로 이동. `UnitPriceModal.test.tsx` — 목록·입력·저장·고객번호0 안내. 기존 통과 케이스(권한·초기안내·공실·탭·이력) 유지.
- **Route Handler**: `ledger/route.test.ts` — 파라미터 검증·403·`Content-Disposition` 파일명 인코딩(exceljs 목 또는 버퍼 크기 확인).
- **RLS·RPC(SQL, `supabase/verify/p5b_checks.sql`)**: `utilities` 없는 구성원 신규 2테이블 **SELECT 가능·쓰기 거부**; 보유·마스터 가능. 단가 해석 3케이스(일치·단일고객번호·폴백null). `save_meter_readings` 요금=`max(0, round(usage×price)−disc)`. `confirm_utilities` 입주세대 합계·재확정. `is_dirty` 확정후 수정 감지. 타 org 격리.
- **정적**: `tsc --noEmit` + `npm run lint`.
- **라이브 미적용**: 원격 미접속 → vitest+tsc+verify SQL 정적. 적용·E2E는 사용자 PC(순서 …0013→**0014**).

---

## 10. 마이그레이션 / 환경

- `supabase/migrations/0014_p5b_utility_pricing.sql`(§3·§4·§5) + `supabase/verify/p5b_checks.sql`.
- **신규 의존성 없음**(엑셀은 기존 `lib/export/xlsx.rowsToXlsxBuffer` 재사용). 신규 env 없음.
- **master 마이그 중복 주의**: `0013_p5_bill_publish.sql` + `0013_platform_drilldown.sql` 병존(기존). 본 슬라이스는 `0014`로 회피. 라이브 적용 순서는 파일명 정렬(`0013_p5_…` → `0013_platform_…` → `0014_…`).
- 적용(사용자): `0014` 실행 → `p5b_checks.sql`.

---

## 11. plan 단계화 (단일 plan, 4그룹)

1. **그룹1 — DB·데이터층**: `0014`(2테이블·RLS·`list_utility_prices`·`save_utility_unit_prices`·`confirm_utilities`·`list_utility_confirmation`·`list_utility_rows`/`save_meter_readings` 확장) + `p5b_checks.sql` → `apis.ts`(신규 함수·`resolvedUnitPrice`·매퍼) + keys/queries/mutations + `apis.test.ts`.
2. **그룹2 — 단가·계산**: `UnitPriceModal` + 테이블 `단가`·`자동요금` 실컬럼 + 요약/이력 실데이터 + 안내배너 정리 + 관련 테스트.
3. **그룹3 — 부과확정**: `부과 확정` 확인팝업·`confirm_utilities` 배선·확정 배지·`is_dirty` 경고 + 테스트.
4. **그룹4 — 검침대장 엑셀**: `app/api/utilities/ledger/route.ts`(`rowsToXlsxBuffer` 재사용) + `exportLedger` 실다운로드 배선 + 라우트 테스트.

---

## 12. 열린 항목 / 향후

- **상가 고정 사용량** — `unit_meters.fixed_usage`(또는 별도 config) + 세대별 입력 UI + 계량기 없는 세대 `usage=고정값`. (후속)
- **관리비 통합 확정** — 확정된 공과금을 `/management-fee` `fee_item_charges`(수도료/전기료/가스료)로 반영해 통합 고지서. (후속)
- **수납 연계** — 확정 공과금 → Task 2(수납 자동이체) 데이터 소스.
- **단가 기간 버전** — 인상 시점 관리가 필요하면 `utility_unit_prices`에 `effective_period` 도입(현재는 스냅샷으로 이력 보존).
- **공용전기(`common_elec`) 안분** — 공용 사용량 세대 배분 규칙.
- **반올림 규칙 설정화** — 현재 `round`(반올림) 고정. 건물/유형별 절사·올림 필요 시 설정 도입.
- **단가 편집 위치 이관** — 현재 utilities 모달. 추후 건물 상세 고객번호 섹션과 동기화 가능(테이블은 `building_customer_number_id` 기준이라 무관).
