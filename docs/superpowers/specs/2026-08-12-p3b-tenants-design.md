# 관리비서 — P3b 입주자·세대 관리(`/staff/buildings/[id]/tenants`) 설계 (spec)

- **작성일:** 2026-08-12
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth·Storage) + React Query + react-hook-form + zod + TailwindCSS
- **기준 정본:** `docs/superpowers/specs/2026-08-10-prd-synthesis.md` §E, `docs/prototype/prd/tenant-list.md`, `docs/prototype/prd/tenant-detail.md`
- **로드맵:** `docs/superpowers/plans/2026-08-10-roadmap.md` — 로드맵 P3(건물·입주자)를 P3a/P3b로 분해한 것의 **P3b**(입주자 절반).
- **선행:** P0, P1a(`units`·`occupancies`·`attachments`), P2a(`current_user_org`·`current_user_has_module`·`list_accounts`), P2b(`room_types` 마스터), **P3a**(건물 계층 라우트·`save_building`/`list_buildings` RPC·module RLS·attachments 범용 도메인·`exceljs` 유틸·계층 라우트 `/staff/buildings/[id]`).

---

## 0. 배경 & 위치

로드맵 P3(도메인 코어)의 입주자 절반. P3a(건물)에 이어 세대(호실)·입주자를 PRD 계층 라우트로 완성한다. P3a가 확립한 패턴(계층 라우트·원자적 저장 RPC·module RLS·attachments·목록 definer RPC)을 그대로 계승한다.

핵심 모델: **건물 → 호실(unit) → 현재 입주(occupancy) + 물리정보(계량기·계좌) + 계약(lease) + 이력(history)**. "입주자 등록"은 호실 + 현재 occupancy를 한 번에 생성하며, 공실은 `occupancies.status='vacant'`로 표현한다.

---

## 1. 목표 & 범위

**In scope**
- **탭 레이어**: `app/(staff)/staff/buildings/[id]/layout.tsx` — **건물정보**(`/[id]`, P3a) · **입주자 관리**(`/[id]/tenants`) 탭 네비.
- **`/[id]/tenants` (세대 목록)**: 호실명/입주자명/룸타입/인원/입주일/공실여부/연체여부 컬럼, 호실명 오름차순, 행 더블클릭→상세, 상단 액션(입주자 등록 + **입주자카드 출력** + 관리비부과내역서 출력 **stub**). 빈/로딩/에러 상태.
- **`/[id]/tenants/new` · `/[id]/tenants/[tenantId]` (등록·수정 단일 폼)**: 5섹션 + 통합 저장 1개 + 목록으로(이탈 확인).
  - **섹션1 기본정보**: 호실명(필수)/이름(필수)/입금자명(필수)/룸타입(드롭다운·필수)/인원/연락처1(필수)·2·3/차량번호/입주일(미래=입주예정일).
  - **섹션2 부과·출력설정**: 부과 Y/N·출력 Y/N·공실 Y/N·퇴실일자·연체료 Y/N·단수 Y/N·적요·이사정산 적요.
  - **섹션3 계량기·계좌**: 계량기(수도·전기·가스 각 계량기번호+고객번호), 계좌(수도·전기·가스·관리비 각 은행·계좌·예금주+CMS회원번호).
  - **섹션4 임대차**: 보증금·월세·계약시작·계약종료·만료알림 Y/N + **이전 전출자 이력(읽기전용, 퇴실일 내림차순)**.
  - **섹션5 시설정보**: 자유 텍스트 멀티라인.
- **DB(`0006`)**: `occupancies` 확장 + `unit_meters`·`unit_accounts`·`lease_contracts`·`occupancy_history` + `occupancies.room_type_id` FK. 통합저장 `save_unit_occupancy`·목록 `list_tenants` RPC. `tenants` module RLS.
- reactquery 도메인(units·occupancies 개편 + 신규 4종), zod, 컴포넌트, 입주자카드 출력, 테스트, 검증 SQL(`p3b_checks.sql`).

**Out of scope (후속)**
- **실제 퇴실 처리 플로우**(occupancy_history INSERT·수도지침 이월·적요 리셋·종이→카톡 전환) → **P7**(이사정산). P3b는 `occupancy_history` **테이블 + 읽기전용 표시**, `move_out_date` 필드 저장까지만.
- **관리비부과내역서 출력**(부과금액 필요) → **P5**. P3b는 버튼 stub.
- **연체여부 실데이터**(수납/부과) → P5·P6. P3b 목록의 연체 컬럼은 스텁('-').
- **입주예정일 대시보드 팝업** → **P8**(미래 `move_in_date` 소비).
- **세대별 검침·부과·요금계산** → P5.

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | 진행 단위 | **단일 P3b spec/plan**(내부 3그룹: DB·데이터층 / 목록·탭 / 상세폼·출력) | P3a 선례 · 화면 응집 |
| 2 | 계량기·계좌·임대차 | **정규화 신규 테이블** `unit_meters`·`unit_accounts`·`lease_contracts` | 사용자 확정 · 로드맵 · P5 검침이 `unit_meters` join · 이력/쿼리 유리 |
| 3 | 목록 라우트/탭 | **중첩 라우트 `/[id]/tenants` + `[id]/layout.tsx` 탭 네비** | 사용자 확정 · PRD "건물 상세 내 탭" + 로드맵 route 둘 다 충족 · P3a 건물폼 불변 |
| 4 | 출력물 | **입주자카드만 P3b 구현**, 관리비부과내역서 버튼 stub | 사용자 확정 · 부과내역서는 P5 부과데이터 의존 |
| A | 통합 저장 | **RPC `save_unit_occupancy`(원자적)** — 호실+occupancy+계량기+계좌+임대차 | P3a `save_building` 패턴 계승 · 부분저장 방지 |
| B | 공실 표현 | 기존 **`occupancies.status`**(occupied/vacant/moving_out) 재사용, 공실 Y/N ↔ status | enum 존재 · 신규 컬럼 회피 · 목록 공실여부 동일 소스 |
| C | 입주예정일 | 기존 **`occupancies.move_in_date`** 미래값 재사용(별도 컬럼 없음) | PRD 단일 입주일 필드 · P8 팝업이 미래 move_in_date 소비 |
| D | 입주자 등록 단위 | **호실+현재 occupancy 동시 생성**(save_unit_occupancy). 공실=occupancy.status='vacant' | PRD 상세에 호실명 입력 · 세대=호실+현재입주 |
| E | occupancy_history | **테이블+읽기전용**만. INSERT는 P7 | 로드맵 "P3에서 생성, P7에서 INSERT" |
| F | RLS 게이트 | `units`·`occupancies` 쓰기 + 신규 4테이블 = **`current_user_has_module('tenants')`**, SELECT org 개방 | P3a buildings 패턴 · 현장직원 쓰기 차단 |
| G | 레거시 컬럼 이관 | `units.elec_customer_no`·`elec_meter_no`·`water_customer_no`→`unit_meters`, `occupancies.deposit`·`monthly_rent`→`lease_contracts`(원컬럼 제거) | 정규화 일관 · dev DB라 리스크 낮음(P3a `manager_name` 제거 선례) |
| H | 입주자카드 출력 | `exceljs` 공통유틸(P3a `lib/export/xlsx.ts`) 재사용, 라우트 핸들러 | 인프라 재사용 · PDF는 후속(서식 확정 시) |

---

## 3. DB 스키마 — `supabase/migrations/0006_p3b_tenants.sql`

> P0·P1a(`units`·`occupancies`·`attachments`), P2a(`current_user_org`·`current_user_has_module`), P2b(`room_types`), P3a(`buildings` module RLS 패턴)에 의존. 단일 파일.

### 3.1 `occupancies` 확장 + 레거시 이관

```sql
alter table occupancies
  add column phone2 text,
  add column phone3 text,
  add column room_type_id bigint references room_types(id) on delete set null,
  add column billing_enabled boolean not null default true,
  add column print_enabled   boolean not null default true,
  add column late_fee_enabled boolean not null default true,
  add column single_print    boolean not null default false,
  add column billing_note    text,   -- 적요
  add column settlement_note text,   -- 이사정산 적요
  add column facility_note   text,   -- 섹션5 시설정보
  drop column deposit,               -- → lease_contracts
  drop column monthly_rent;          -- → lease_contracts
create index on occupancies (room_type_id);
```
- `phone`(연락처1, 기존)·`phone2`·`phone3`. `payer_name`(입금자명)·`tenant_name`(이름)·`vehicle_no`·`resident_count`·`move_in_date`·`move_out_date`·`status`·`memo`(미사용 유지)는 기존.

### 3.2 `units` 레거시 이관 + `unit_meters`

```sql
alter table units
  drop column elec_customer_no,
  drop column elec_meter_no,
  drop column water_customer_no;

create table unit_meters (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  utility text not null check (utility in ('water','elec','gas')),
  meter_no text, customer_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, utility)
);
create index on unit_meters (unit_id);
```

### 3.3 `unit_accounts`

```sql
create table unit_accounts (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  kind text not null check (kind in ('water','elec','gas','mgmt')),
  bank text, account text, holder text,
  cms_member_no text,   -- 효성CMS 회원번호(P6 연동 대비)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, kind)
);
create index on unit_accounts (unit_id);
```

### 3.4 `lease_contracts` (현재 계약 1:1)

```sql
create table lease_contracts (
  id bigint generated always as identity primary key,
  occupancy_id bigint not null references occupancies(id) on delete cascade,
  deposit bigint, monthly_rent bigint,   -- 원 단위 정수
  start_date date, end_date date,
  expiry_alert boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (occupancy_id)
);
create index on lease_contracts (occupancy_id);
```

### 3.5 `occupancy_history` (전출자 이력 — P3b는 읽기전용)

```sql
create table occupancy_history (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  tenant_name text, move_in_date date, move_out_date date,
  room_type_label text,   -- 퇴실 시점 룸타입 스냅샷
  created_at timestamptz not null default now()
);
create index on occupancy_history (unit_id, move_out_date desc);
```

### 3.6 트리거

```sql
do $$ declare t text; begin
  foreach t in array array['unit_meters','unit_accounts','lease_contracts'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;
```

---

## 4. RPC

### 4.1 `save_unit_occupancy` (원자적)

```sql
create or replace function save_unit_occupancy(
  p_building_id bigint,
  p_unit_id bigint,                 -- null = 신규 호실
  p_occupancy_id bigint,            -- null = 신규 입주
  p_unit jsonb,                     -- {unit_no, dong, area_pyeong, room_count}
  p_occupancy jsonb,                -- {tenant_name, payer_name, phone, phone2, phone3, vehicle_no, resident_count, room_type_id, move_in_date, move_out_date, status, billing_enabled, print_enabled, late_fee_enabled, single_print, billing_note, settlement_note, facility_note}
  p_meters jsonb,                   -- [{utility, meter_no, customer_no}]
  p_accounts jsonb,                 -- [{kind, bank, account, holder, cms_member_no}]
  p_lease jsonb                     -- {deposit, monthly_rent, start_date, end_date, expiry_alert}
) returns jsonb                     -- { unit_id, occupancy_id }
language plpgsql security definer set search_path = public as $$ ... $$;
```
**책임(트랜잭션 1회)**: `current_user_org()` 파생 + `current_user_has_module('tenants')` 검증. 호실이 대상 건물(내 org) 소속인지 확인. unit insert/update(unique unit_no per building), occupancy insert/update(unit_id 연결), unit_meters/unit_accounts **upsert by (unit_id, utility|kind)**, lease_contract upsert by occupancy_id. `p_*` 누락 키는 기존값 보존. 반환 `{unit_id, occupancy_id}`. `revoke ... from anon`.

### 4.2 `list_tenants` (definer)

```sql
create or replace function list_tenants(p_building_id bigint)
returns table(
  unit_id bigint, occupancy_id bigint, unit_no text, tenant_name text,
  room_type_label text, resident_count int, move_in_date date,
  is_vacant boolean, is_overdue boolean
) language sql stable security definer set search_path = public as $$
  select u.id, o.id, u.unit_no, o.tenant_name,
    rt.label, o.resident_count, o.move_in_date,
    (o.status = 'vacant') as is_vacant,
    false as is_overdue        -- P6 수납/부과 연동 전 스텁
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select * from occupancies oc where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc limit 1
  ) o on true
  left join room_types rt on rt.id = o.room_type_id
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;
revoke execute on function list_tenants(bigint) from anon;
```

---

## 5. RLS — `tenants` module (P3a 패턴 계승)

```sql
alter table unit_meters       enable row level security;
alter table unit_accounts     enable row level security;
alter table lease_contracts   enable row level security;
alter table occupancy_history enable row level security;

-- unit_meters/unit_accounts: unit→building→org 범위 SELECT 개방, 쓰기 tenants 모듈
create policy um_select on unit_meters for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy um_write on unit_meters for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'));
-- unit_accounts 동일(ua_select/ua_write), lease_contracts는 occupancy→unit→building→org(lc_select/lc_write), occupancy_history는 unit 경유(oh_select 개방 + oh_write tenants)

-- 기존 units·occupancies 쓰기 조이기(P1a 개방 → tenants 모듈)
drop policy unit_all on units;
create policy unit_select on units for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy unit_write on units for all
  using      (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('tenants'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('tenants'));
drop policy occ_all on occupancies;
create policy occ_select on occupancies for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy occ_write on occupancies for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'));
```
- `save_unit_occupancy`는 definer이나 내부 `current_user_has_module('tenants')` 명시 검증.

---

## 6. 데이터 계층 (reactquery)

- **`units`·`occupancies` 개편**: 인터페이스 확장(FK·플래그·연락처3), 매퍼. 개별 CRUD는 최소화하고 저장은 `save_unit_occupancy`가 담당.
- **신규 도메인**: `unitMeters`·`unitAccounts`·`leaseContracts`·`occupancyHistory` (조회·매퍼 위주).
- **buildings 도메인 확장**: `getUnitOccupancyFull(unitId)`(unit+occupancy+meters+accounts+lease 조립), `listTenants(buildingId)`(RPC), `saveUnitOccupancy(payload)`(RPC 래퍼, camel→snake).
- **재사용**: `room_types`(P2b) 드롭다운, `attachments`(P3a) — 세대 첨부 필요 시, `useStaffOptions` 불필요(입주자엔 담당자 없음).
- zod: `occupancy`(개편)·`unitMeter`·`unitAccount`·`leaseContract`.

---

## 7. 페이지 & 컴포넌트

- `app/(staff)/staff/buildings/[id]/layout.tsx` — 탭 네비(건물정보=`/[id]`, 입주자 관리=`/[id]/tenants`). `usePathname`로 활성 탭. 게이트: 건물 접근은 `buildings`, 입주자 탭 내용은 `tenants`.
- `[id]/tenants/page.tsx` — `TenantList`(게이트 `tenants`).
- `[id]/tenants/new/page.tsx` · `[id]/tenants/[tenantId]/page.tsx` — `TenantForm`.
- `components/TenantList.tsx` — `DataTable`(호실/입주자/룸타입/인원/입주일/공실/연체) + 더블클릭 네비 + 등록 버튼 + 입주자카드 출력(링크) + 부과내역서 stub(비활성 Button).
- `components/TenantForm.tsx` + `sections/{BasicInfoSection,BillingSettingsSection,MetersAccountsSection,LeaseSection,FacilityNoteSection}.tsx` — 로컬 폼 상태 + `saveUnitOccupancy`. `LeaseSection`은 `occupancyHistory` 읽기전용 목록 포함. P3a `BuildingForm` 구조 미러.

> **Next 주의(AGENTS.md)**: `layout.tsx`·중첩 동적 라우트(`[tenantId]`)·`usePathname`/`useParams` 시그니처는 구현 전 `node_modules/next/dist/docs/` 확인.

---

## 8. 출력물 — 입주자카드

- `app/api/buildings/[id]/tenant-cards/route.ts`(GET) — 건물 전체 세대의 입주자카드 데이터를 `exceljs`(P3a `lib/export/xlsx.ts`)로 `.xlsx` 생성. 컬럼: 호실/이름/입금자명/룸타입/인원/연락처/입주일/보증금·월세/계량기·계좌 요약. 파일명 `입주자카드_{건물명}_YYYYMMDD.xlsx`.
- 회사명 워터마크(설정 I-6)는 후속(PDF 전환 시).
- **관리비부과내역서**: `TenantList`에 비활성 stub 버튼(P5 연동 주석).

---

## 9. 테스트 전략 (TDD)

- **단위(Vitest)**: 도메인 매퍼(snake↔camel, meters/accounts/lease 배열), `saveUnitOccupancy` payload 매핑, `listTenants` 매핑, zod(연락처 필수·룸타입 필수·enum·정수 금액), `lib/export` 입주자카드 컬럼.
- **컴포넌트(RTL)**: `layout` 탭 전환, `TenantList`(더블클릭·빈/공실 표시·등록 네비), `TenantForm`(필수 검증·섹션 배열 행·저장 payload·이탈 확인), `LeaseSection` 이력 읽기전용.
- **RLS·RPC(SQL, `p3b_checks.sql`)**: `tenants` 없는 구성원 units/occupancies/신규4 **SELECT 가능·쓰기 거부**; 보유·마스터 쓰기 가능. `save_unit_occupancy` 신규 호실+입주+자식 upsert, 타 org 호실 거부. 신규 테이블 타 org 격리.
- **정적**: `tsc --noEmit` + `npm run lint`.
- **라이브 미적용**: 원격 미접속 → vitest+tsc+verify SQL 정적. 적용·E2E는 사용자 PC(순서 0004→0006).

---

## 10. 마이그레이션 / 환경

- `supabase/migrations/0006_p3b_tenants.sql`(§3·§4·§5) + `supabase/verify/p3b_checks.sql`.
- 신규 env 없음. Storage `attachments` 재사용(세대 첨부 시).
- 적용(사용자): `0006` 실행 → `p3b_checks.sql`. **DB pending-user**, 순서 …0003→0004→0006.

---

## 11. plan 단계화 (단일 plan, 3그룹)

1. **그룹1 — DB·데이터층**: `0006`(occupancies 확장·신규4·RLS·`save_unit_occupancy`·`list_tenants`·레거시 이관) + `p3b_checks.sql` → units/occupancies 개편 + 신규 도메인 4종 + `getUnitOccupancyFull`·`listTenants`·`saveUnitOccupancy` + zod.
2. **그룹2 — 목록·탭**: `[id]/layout.tsx` 탭 + `[id]/tenants/page.tsx` + `TenantList`.
3. **그룹3 — 상세폼·출력**: `/new`·`/[tenantId]` + `TenantForm` 5섹션(이력 읽기전용 포함) + 입주자카드 라우트·`exceljs`.

---

## 12. 열린 항목 / 향후

- **입주자카드 서식** — 우선 xlsx 요약. PDF·워터마크는 서식 확정 후.
- **퇴실 처리 플로우**(occupancy_history INSERT·수도 이월·적요 리셋) → P7.
- **연체여부·부과내역서 실데이터** → P5·P6.
- **입주예정일 팝업** → P8.
- **계량기 6개월 이력** → P5(`meter_readings`).
- **세대 다중 계약 이력**(lease_contracts 현재 1:1 → 이력화) → 필요 시 후속.

---

## 부록. PRD → P3b 배치

| PRD | 배치 |
|---|---|
| tenant-list 3.0 상단액션 | `TenantList` 헤더(등록·입주자카드·부과내역서 stub) |
| tenant-list 3.1 세대 테이블 | `list_tenants` RPC + `DataTable` + 더블클릭 |
| tenant-detail 3.1 기본정보 | `BasicInfoSection` + occupancies(연락처3·room_type_id) |
| tenant-detail 3.2 부과·출력 | `BillingSettingsSection` + occupancies 플래그·적요 |
| tenant-detail 3.3 계량기·계좌 | `MetersAccountsSection` + `unit_meters`·`unit_accounts` |
| tenant-detail 3.4 임대차 | `LeaseSection` + `lease_contracts` + `occupancy_history`(읽기전용) |
| tenant-detail 3.5 시설정보 | `FacilityNoteSection` + `occupancies.facility_note` |
