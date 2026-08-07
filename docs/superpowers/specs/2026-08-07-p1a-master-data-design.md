# 주택관리 ERP — P1a 기초정보(건물·항목·거래처) 마스터 설계 (spec)

- **작성일:** 2026-08-07
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth·Storage) + React Query + TailwindCSS
- **기준:** P0(인증·세션·조직) 위에 구축. `generate-frontend-projects` 컨벤션(route handler 없음, 타입은 `hooks/reactquery/[도메인]/apis.ts`, Supabase 직접 호출, org_id + RLS).
- **관련:** `2026-08-07-p0-auth-foundation-design.md`, 기능명세서 MST-01/02/03/05/06, ERD, 프로토타입 `staff/{building-list,fee-item,vendor-management}.dc.html`

---

## 0. 배경 & 위치

P1(기초정보·설정)은 규모가 커서 3개로 분해했다: **P1a(본 문서, 건물·항목·거래처 마스터)** · P1b(계정·권한 = staff-management) · P1c(환경설정 = setup). `management-fee-setting`의 검침입력/공과금 계산 워크시트는 P1이 아니라 **P2(검침)/P3(부과)**로 이관한다.

P1a는 세 staff 화면을 **풀스택(SQL 마이그레이션 + reactquery 훅 + Next.js 페이지/폼/리스트)**으로 구현한다: `building-list`, `fee-item`, `vendor-management`. 프로토타입은 전부 `localStorage` 목업 → Supabase로 대체.

---

## 1. 목표 & 범위

**In scope**
- **건물 마스터**: `buildings` CRUD + **호실(`units`)** + **입주자/점유(`occupancies`)** 핵심 마스터, 마스터-디테일 UI.
- **부과 항목**: 건물유형(`building_types`, 조직별 편집형)별 `fee_items` CRUD(반올림/일자계산/이월/필수 플래그, 정렬).
- **거래처**: 구분(`vendor_categories`, 조직별 편집형)별 `vendors` CRUD + **계약서 사진 첨부(`attachments` + Supabase Storage)**.
- 위 도메인의 RLS(org 격리), reactquery 훅, Next.js 화면.

**Out of scope (후속)**
- 검침 고객번호의 계산/검침 설정, 세대별 부과여부·고지옵션·연체·부과일 → **P2/P3**에서 `units`/신규 테이블에 확장.
- 모듈별 **세분 권한 강제**(누가 마스터를 수정 가능한지) → **P1b**. P1a는 인증된 활성 org 구성원이면 CRUD 가능(가드는 P0 미들웨어).
- 건물주(임대인) 정산·부번호·정산계좌(`building_owners`) → 임대 정산 단계. P1a는 `buildings`에 `owner_name/owner_phone`만.
- 담당자(관리/검침/청소)의 직원 계정 FK 연결 → 후속. P1a는 텍스트 필드.
- 세입자(카카오) 연결 → 세입자 포털.

---

## 2. 확정된 결정

| # | 결정 | 값 |
|---|---|---|
| 1 | 모델링 깊이 | **핵심 마스터만** — 부과/고지/검침설정 필드는 P2/P3로 |
| 2 | 건물유형 | **조직별 설정형 `building_types`** (라벨 편집), `buildings.type_id` + `fee_items.type_id` |
| 3 | 거래처 구분 | **조직별 설정형 `vendor_categories`** + `vendors.category_id` |
| 4 | 계약서 사진 | **`attachments` + Supabase Storage** (v0.3 attachments 재사용) |
| 5 | 구현 범위 | **풀 구현**(SQL + 훅 + 페이지) |
| 6 | 건물주 | `buildings.owner_name/owner_phone` 인라인 |
| 7 | 담당자 | 텍스트 필드(`manager_name`·`meter_staff_name`·`cleaning_staff_name`) |
| 8 | 인원 | `occupancies.resident_count` |
| 9 | units/occupancies RLS | **부모 FK 경유**(org_id 비정규화 없이) |
| 10 | 권한 | P1a는 활성 org 구성원 전체 CRUD, 세분 권한은 P1b |

---

## 3. DB 스키마 (P1a 마이그레이션 — P0의 `0000_*` 이후)

> 파일: `supabase/migrations/0001_p1a_master_data.sql`. P0의 `organizations`·`my_org_ids()`·`set_updated_at()`에 의존.

### 3.1 ENUM

```sql
create type fee_rounding      as enum ('up','round','down','raw');   -- 절상/4사5입/절하/그대로
create type occupancy_status  as enum ('occupied','vacant','moving_out');
create type attachment_kind   as enum ('contract','repair','facility','etc');
```

### 3.2 building_types (조직별 편집형 건물유형)

```sql
create table building_types (
  id         bigint generated always as identity primary key,
  org_id     bigint not null references organizations(id) on delete cascade,
  label      text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, label)
);
```

### 3.3 buildings

```sql
create table buildings (
  id                  bigint generated always as identity primary key,
  org_id              bigint not null references organizations(id) on delete cascade,
  code                text not null,
  name                text not null,
  address             text,
  type_id             bigint references building_types(id) on delete set null,
  owner_name          text,
  owner_phone         text,
  entrance_password   text,          -- 공동현관 비번
  manager_name        text,          -- 관리 담당자(텍스트)
  meter_staff_name    text,          -- 검침 담당자
  cleaning_staff_name text,          -- 청소 담당자
  memo                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, code)
);
```

### 3.4 units (호실 — 핵심)

```sql
create table units (
  id                bigint generated always as identity primary key,
  building_id       bigint not null references buildings(id) on delete cascade,
  unit_no           text not null,               -- 호실
  dong              text,                          -- 동/라인
  area_pyeong       numeric(8,2),                  -- 평형
  room_count        int,                           -- 룸
  elec_customer_no  text,                          -- 한전 고객번호
  elec_meter_no     text,                          -- 한전 계기번호
  water_customer_no text,                          -- 수도 고객번호
  memo              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (building_id, unit_no)
);
create index on units (building_id);
```

### 3.5 occupancies (입주자/점유 — 핵심)

```sql
create table occupancies (
  id             bigint generated always as identity primary key,
  unit_id        bigint not null references units(id) on delete cascade,
  tenant_name    text,                 -- 입주자명
  payer_name     text,                 -- 입금자명
  phone          text,
  resident_count int,                  -- 인원
  vehicle_no     text,                 -- 차량번호
  move_in_date   date,
  move_out_date  date,
  deposit        numeric(12,0),        -- 보증금
  monthly_rent   numeric(12,0),        -- 월세
  status         occupancy_status not null default 'occupied',
  memo           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on occupancies (unit_id);
```

### 3.6 fee_items (건물유형별 부과항목)

```sql
create table fee_items (
  id              bigint generated always as identity primary key,
  org_id          bigint not null references organizations(id) on delete cascade,
  type_id         bigint not null references building_types(id) on delete cascade,
  name            text not null,
  rounding        fee_rounding not null default 'round',
  daily_proration boolean not null default false,   -- 일자계산 적용
  carry_over      boolean not null default false,   -- 이월
  is_required     boolean not null default false,   -- 전기/수도/가스 고정
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (type_id, name)
);
create index on fee_items (org_id, type_id, sort_order);
```

### 3.7 vendor_categories / vendors

```sql
create table vendor_categories (
  id         bigint generated always as identity primary key,
  org_id     bigint not null references organizations(id) on delete cascade,
  label      text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, label)
);

create table vendors (
  id           bigint generated always as identity primary key,
  org_id       bigint not null references organizations(id) on delete cascade,
  category_id  bigint references vendor_categories(id) on delete set null,
  name         text not null,               -- 업체명
  phone        text,
  bank_account text,                          -- 계좌번호
  memo         text,                          -- 비고
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on vendors (org_id, category_id);
```

### 3.8 attachments (계약서 사진 등 — 다형 참조)

```sql
create table attachments (
  id          bigint generated always as identity primary key,
  org_id      bigint not null references organizations(id) on delete cascade,
  entity_type text not null,                 -- 'vendor'/'building'/'unit' 등
  entity_id   bigint not null,
  kind        attachment_kind not null default 'etc',
  file_url    text not null,                 -- Supabase Storage 경로(버킷 내 path)
  file_name   text,
  uploaded_by uuid,
  created_at  timestamptz not null default now()
);
create index on attachments (entity_type, entity_id);
```

### 3.9 updated_at 트리거

`building_types, buildings, units, occupancies, fee_items, vendor_categories, vendors`에 `set_updated_at()` before-update 트리거(P0 함수 재사용).

---

## 4. RLS 정책

`my_org_ids()`(P0, SECURITY DEFINER, 활성 org id 집합) 재사용. 마스터 데이터는 활성 org 구성원이 **전체 CRUD**(P1a). 세분 권한은 P1b.

```sql
alter table building_types    enable row level security;
alter table buildings         enable row level security;
alter table units             enable row level security;
alter table occupancies       enable row level security;
alter table fee_items         enable row level security;
alter table vendor_categories enable row level security;
alter table vendors           enable row level security;
alter table attachments       enable row level security;

-- org 직속 테이블: for all (select/insert/update/delete)
create policy bt_all  on building_types    for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy bld_all on buildings         for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy fi_all  on fee_items         for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy vc_all  on vendor_categories for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy vnd_all on vendors           for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy att_all on attachments       for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));

-- units: 부모 building의 org 경유
create policy unit_all on units for all
  using      (building_id in (select id from buildings where org_id in (select my_org_ids())))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())));

-- occupancies: unit → building org 경유
create policy occ_all on occupancies for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
```

> `insert` 시 `org_id`는 클라이언트가 현재 컨텍스트(`useMe().orgId`)로 채운다. `with check`가 타 org 위조를 차단.

---

## 5. Storage (계약서 사진)

- 버킷 `attachments`(private). 경로 규칙: `{org_id}/{entity_type}/{entity_id}/{uuid}-{filename}`.
- `storage.objects` 정책: 활성 org 구성원이 자기 org 경로(prefix `{org_id}/`)만 read/write. (org_id는 경로 첫 세그먼트로 판정.)
- 업로드: 클라이언트가 Supabase Storage에 업로드 → 반환 path를 `attachments.file_url`에 저장. 조회는 signed URL.
- **버킷 생성 + Storage 정책은 수동 SQL/대시보드(사용자)** — `supabase/verify/p1a_storage.sql`에 정책 스니펫 제공. (P0 마이그레이션과 동일하게 pending-user)

---

## 6. 데이터 계층 (reactquery 도메인)

P0 컨벤션(apis/keys/queries/mutations/index). snake_case DB ↔ camelCase 앱 매핑은 각 `apis.ts`.

| 도메인 | 주요 훅 | 비고 |
|---|---|---|
| `buildings/` | `useBuildings(search?)`, `useBuilding(id)`, `useCreateBuilding`, `useUpdateBuilding`, `useDeleteBuilding` | org 스코프(RLS), 검색=name/address ilike |
| `units/` | `useUnits(buildingId)`, `useCreateUnit`, `useUpdateUnit`, `useDeleteUnit` | building별 |
| `occupancies/` | `useOccupancies(unitId)`, `useCreateOccupancy`, `useUpdateOccupancy`, `useDeleteOccupancy` | unit별 |
| `buildingTypes/` | `useBuildingTypes`, `useCreateBuildingType`, `useRenameBuildingType`, `useDeleteBuildingType`, `useReorderBuildingTypes` | fee-item 탭 |
| `feeItems/` | `useFeeItems(typeId)`, `useCreateFeeItem`, `useUpdateFeeItem`, `useDeleteFeeItem`, `useReorderFeeItems` | 필수항목 정렬/삭제 제약 |
| `vendorCategories/` | `useVendorCategories`, `useCreateVendorCategory`, `useRenameVendorCategory`, `useDeleteVendorCategory` | 사이드바 |
| `vendors/` | `useVendors(categoryId?, search?)`, `useCreateVendor`, `useUpdateVendor`, `useDeleteVendor`, `useUploadVendorAttachment`, `useVendorAttachments(vendorId)` | 첨부 업로드 |

타입은 각 `apis.ts`에 정의(예: `Building`, `BuildingInput`, `Unit`, `Occupancy`, `FeeItem`, `Vendor`, `Attachment`). zod 스키마는 `components/forms/schema/`(building.ts, unit.ts, occupancy.ts, feeItem.ts, vendor.ts).

**공통 규칙**
- 뮤테이션 성공 시 관련 쿼리 무효화(`invalidateQueries`).
- 필수 fee_item(is_required)은 이름변경/삭제/정렬-잠금 제약을 훅/폼에서 강제(전기·수도·가스).
- 삭제는 확인 + 낙관적 토스트(sonner). FK 있는 삭제(건물→호실)는 cascade(DB) + UX 경고.

---

## 7. 페이지 (app/(staff)/staff/)

P0 미들웨어가 `/staff/*` 인증 가드. 각 페이지는 `page.tsx` + `components/`.

### 7.1 building-list
- 좌: 건물 리스트(검색 name/address, 컬럼 코드·건물명·유형·주소·건물주·담당자·등록일, `＋ 건물 등록`).
- 우: 선택 건물 상세 + **호실/입주자 패널**(호실 리스트 + 선택 호실의 입주자, `＋ 호수·입주민 등록`).
- 컴포넌트: `BuildingTable`, `BuildingFormModal`, `BuildingDetailPanel`, `UnitList`, `UnitFormModal`, `OccupancyList`, `OccupancyFormModal`.
- URL: `?bld=<code>` 자동선택(프로토타입 호환).

### 7.2 fee-item
- 상단 건물유형 탭(추가/이름변경/삭제, 최소 1개), 탭별 항목 리스트(반올림/일자계산/이월, 드래그 정렬), `＋ 항목 추가`(모달), 필수항목(전기·수도·가스) 상단 고정·삭제불가.
- 컴포넌트: `BuildingTypeTabs`, `FeeItemList`, `FeeItemFormModal`.

### 7.3 vendor-management
- 좌: 구분 사이드바(카운트, 추가/이름변경), 우: 업체 리스트(구분·업체명·연락처, 검색), 행 클릭→수정 모달(업체명·전화·계좌·계약서사진·비고), `＋ 업체 추가`.
- 컴포넌트: `VendorCategorySidebar`, `VendorList`, `VendorFormModal`(사진 업로드 포함).

공통 UI: `components/common/`의 로딩/빈상태/모달/검색바(없으면 P1a에서 생성).

---

## 8. 에러 처리 & UX
- 사용자 친화 토스트(sonner), `throw`/`console.error` 노출 지양.
- 필수항목/최소 1개 유형·구분 등 제약은 폼에서 사전 검증 + 서버 제약(unique) 위반 시 친화 메시지.
- 삭제 확인, cascade 경고(건물 삭제 시 호실·입주자 함께 삭제).

---

## 9. 환경 / 마이그레이션 적용
- 신규 env 없음(P0의 Supabase URL/anon 재사용).
- 적용(사용자): `supabase/migrations/0001_p1a_master_data.sql` 실행 → `supabase/verify/p1a_storage.sql`로 `attachments` 버킷 + Storage 정책 생성. (P0와 동일 pending-user)

---

## 10. 테스트 전략
- **단위(TDD, Vitest)**: 각 도메인 `apis.ts` 매퍼(snake↔camel)·zod 스키마·뮤테이션 훅(Supabase mock). 필수 fee_item 제약 로직.
- **RLS(SQL 검증)**: 타 org 데이터 CRUD 불가, units/occupancies 부모경유 격리, `with check` org 위조 차단 → `supabase/verify/p1a_checks.sql`.
- **컴포넌트(RTL)**: 폼 검증, 리스트/빈상태 렌더, 유형/구분 탭 전환, 필수항목 고정.
- **E2E**: 시드 데이터로 건물→호실→입주자 CRUD, 항목/거래처 CRUD, 사진 업로드 — **라이브 Supabase 후(pending-user)**.

---

## 11. 열린 항목 / 향후
- 담당자 텍스트 → 직원 계정 FK(P1b 이후).
- building_owners(임대인) 테이블(임대 정산 단계).
- units 부과/고지/검침 설정 컬럼(P2/P3).
- 세분 권한(P1b)으로 마스터 편집 권한 제한.
- 대량입력 그리드(검침/부과는 P2/P3에서 AG Grid 등).

## 부록. 프로토타입 필드 → P1a 배치
- building-list 호실 서브테이블의 부과여부·고지옵션·연체·부과일·문자수신·이체방식 등 → **P3**(units 확장). 한전/수도 고객번호는 P1a units에 보관(검침 계산설정은 P2).
- management-fee-setting 워크시트(수도/전기/가스 검침값·단가·부과액) → **P2/P3**.
