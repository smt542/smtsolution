# 관리비서 — P3a 건물 관리(`/staff/buildings`) 설계 (spec)

- **작성일:** 2026-08-12
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth·Storage) + React Query + TailwindCSS
- **기준 정본:** `docs/superpowers/specs/2026-08-10-prd-synthesis.md` §E, `docs/prototype/prd/building-list.md`, `docs/prototype/prd/building-detail.md`
- **로드맵:** `docs/superpowers/plans/2026-08-10-roadmap.md` — 로드맵 **P3(건물·입주자)를 P3a/P3b로 분해**한 것의 **P3a**(건물 절반).
- **선행:** P0(인증·조직·`org_members`·`my_org_ids()`·`audit_log`·`set_updated_at`), P1a(`buildings`·`units`·`occupancies`·`attachments`·소프트삭제 RPC·Storage 버킷 `attachments`), P2a(`current_user_has_module()`·`current_user_org()`·`list_accounts()`·`staff_type`), P2b(`room_types`·`septic_vendors` 마스터, 첫 module-permission RLS 패턴).

---

## 0. 배경 & 위치

로드맵 **P3(건물·입주자, 도메인 코어)**는 규모가 커서(화면 5개 + 신규 엔티티 6~7개) 둘로 분해한다: **P3a(본 문서 — 건물)** · **P3b(입주자, 후속)**. P2를 P2a/P2b로 나눈 것과 동일한 방식(사용자 확정).

P3a는 건물 도메인을 **PRD 정본 라우트 구조**로 완성한다:

- 기존 `/staff/buildings`는 **P1a 시절의 단순 마스터 CRUD**(좌측 목록 + 우측 상세 패널 + 모달 폼 + `UnitList`)다. PRD가 요구하는 **계층 라우트**(`/buildings/new`, `/buildings/:id`)와 **건물 상세 5섹션**과는 구조가 다르다 → **재구축**한다.
- 담당자(관리·검침·청소)를 현재 **자유텍스트**(`manager_name` 등)에서 **직원 계정 FK**로 승격해 PRD의 "직원 계정 드롭다운 선택 + 담당자별 목록 필터"를 실현한다.
- **첫 서버사이드 엑셀(xlsx) 공통 유틸**을 구축한다(로드맵 횡단 관심사 "엑셀 입출력" 시작점 — 이후 P5 검침대장·P6 수납매칭이 재사용).

P2b와 달리 **파일 첨부(협력업체 계약서)가 다시 등장**하므로 P1a/P2b의 `attachments` + Storage 버킷 패턴(`longTermRepair` 미러)을 재사용한다.

---

## 1. 목표 & 범위

**In scope**

- **`/staff/buildings` (목록)**: 담당자 3종(관리·검침·청소) 필터 + 페이지네이션(10/20/50, 기본 20, 페이지번호 방식) + 엑셀 다운 + 행 더블클릭 → 상세. 기본 정렬 **등록일 최신순**. 빈/로딩/결과없음/에러 상태.
- **`/staff/buildings/new` · `/staff/buildings/[id]` (등록·수정, 모드 분기 단일 폼)**: 상세 5섹션 + **저장 버튼 1개(통합 저장)** + 목록으로(변경 시 이탈 확인).
  - **섹션1 기본정보**: 건물코드, 건물명(필수), 주소(필수), 관리·검침·청소 담당자(직원 계정 드롭다운).
  - **섹션2 시설정보**: 9종 체크박스 + 각 메모(CCTV/승강기/청소담당/검침담당/관리담당/정화조/인터넷/전기안전관리/소방안전관리). 미체크 시 메모 비활성.
  - **섹션3 고객번호**: 유형(수도/공용전기/전기/가스) **복수 등록**. 1건당 고객번호(필수)/유형/검침일(매월 N일)/부과기간(전월·당월)/고지서출력 Y/N/명의자. 행 추가·삭제.
  - **섹션4 협력업체**: 유형(승강기/소방안전/전기안전/정화조/기타). 1건당 업체명(필수)/유형/계약서 파일 업로드(이미지·PDF, 수 제한 없음). 행 추가·삭제, 파일 썸네일/파일명 목록·원본 보기.
  - **섹션5 참고사항**: 자유 텍스트 멀티라인, 최대 1,000자, 잔여 글자수 표시.
- **DB(`0004`)**: `buildings` 변경(담당자 FK 3 + `facilities` jsonb, 레거시 담당자명 3컬럼 제거) + 신규 `building_customer_numbers` + `building_vendors`. 통합 저장 RPC `save_building`. module-permission RLS(`buildings` 게이트).
- **엑셀**: `exceljs` 도입, 공통 유틸 `lib/export/xlsx.ts` + 라우트 핸들러 `app/api/buildings/export/route.ts`.
- reactquery 도메인(`buildings` 개편 + `buildingCustomerNumbers` + `buildingVendors` + `attachments` 범용화), zod 스키마, 컴포넌트, 테스트, 검증 SQL(`p3a_checks.sql`).

**Out of scope (P3b 이후)**

- **입주자(세대) 전체**: 입주자 목록 탭, 입주자 등록/상세 5섹션, `occupancies` 컬럼 확장(입주예정일·연락처3·플래그·적요), `unit_meters`·`unit_accounts`·`lease_contracts`·`occupancy_history`, `room_types` FK 연결 → **P3b**.
- **출력물(입주자카드·관리비부과내역서)**: 입주자 목록 화면 상단 액션 → **P3b**(내역서는 부과데이터 P5 필요).
- **기존 `units`/`occupancies` 훅·컴포넌트 개편**: 세대 관리는 P3b 소관. P3a는 건물 계층까지만.
- **입주예정일 대시보드 팝업**: 데이터는 P3b(occupancies), 소비는 **P8**.
- **설정 마스터 소비 심화**: `septic_vendors`(정화조업체 드롭다운) 등은 필요 시 P3a에서 참조하되, 마스터 관리 자체는 P2b `/setup`.

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | 진행 단위 | **P3a(건물) / P3b(입주자) 분리**. 각각 spec→plan→구현→PR | 사용자 확정 · P2a/P2b 선례 · 리뷰 단위 축소 |
| 2 | 담당자 모델링 | **계정 FK 전환**: `manager_user_id`·`meter_user_id`·`cleaning_user_id`(→`auth.users`, `on delete set null`). 레거시 `manager_name`·`meter_staff_name`·`cleaning_staff_name` **컬럼 제거** | 사용자 확정 · PRD "직원 계정 드롭다운 + 담당자 필터" · 계정은 비활성만(삭제 없음)이라 FK 유지 · DB dev-only라 컬럼 제거 리스크 낮음 |
| 3 | 엑셀 스코프 | **P3a에 서버사이드 xlsx 공통 유틸 구축** + 건물목록 다운 | 사용자 확정 · PRD 명시 · 로드맵 횡단 "엑셀 입출력" 시작점(P5·P6 재사용) |
| A | 통합 저장 | **RPC `save_building`(원자적)** — 건물 + 고객번호 N + 협력업체 N(메타) + 시설 jsonb를 한 트랜잭션. 파일은 저장 후 후속 업로드 | 사용자 확정(A안) · PRD "전체 섹션 통합 저장" · 부분저장 방지 · P2a `provision_member` RPC 패턴 일관 |
| B | 시설정보 | **`buildings.facilities jsonb`**(고정 9키, 각 `{on,memo}`) | 항상 건물과 함께 통째 저장 · 고정 스키마 · 자식 테이블 오버킬 |
| C | 협력업체 | **신규 `building_vendors`**(건물별 독립 엔티티, 업체명 자유텍스트). org 마스터 `vendors`와 별개 | PRD 유형(승강기/소방/전기/정화조/기타)이 org `vendor_categories`와 다름 · 업체명 직접 입력 |
| D | 고객번호 | **신규 `building_customer_numbers`**(유형별 복수) | PRD 복수 등록 · 검침일·부과기간·출력여부·명의자 필드 |
| E | 참고사항 | 기존 **`buildings.memo`** 재사용(멀티라인, UI 1000자 제한) | 컬럼 존재 · churn 회피 |
| F | RLS 게이트 | `buildings` 쓰기 + 신규 2테이블 = **`current_user_has_module('buildings')`**. SELECT는 org 범위 개방 | 로드맵 "이후 모든 신규 테이블 module RLS" · 현장직원 쓰기 DB 차단 · 모바일 read 대비 SELECT 개방 |
| G | 파일 저장 | 기존 `attachments` 테이블·버킷 재사용. `entity_type='building_vendor'`, `kind='contract'`(enum 기존값) | P1a enum 재사용 · `longTermRepair` 업로드 패턴 미러 |
| H | 소프트삭제 | 신규 테이블 `deleted_at`(목록 `is null`), 건물 삭제는 기존 `soft_delete_building` 확장(자식 포함) | 로드맵 이력보존 · P1a 패턴 |
| I | 건물코드 | `buildings.code`(not null unique) **유지** — 섹션1에 편집 필드로 노출, 미입력 시 자동 생성(`B####`) | 기존 컬럼·데이터 보존 · PRD 미기재이나 레거시 식별자 · nullable 마이그레이션 회피 |

---

## 3. DB 스키마 — `supabase/migrations/0004_p3a_buildings.sql`

> P0·P1a(`buildings`·`units`·`occupancies`·`attachments`·`soft_delete_building`), P2a(`current_user_has_module`·`current_user_org`)에 의존. 단일 파일.

### 3.1 `buildings` 변경 — 담당자 FK + 시설 jsonb

```sql
alter table buildings
  drop column manager_name,
  drop column meter_staff_name,
  drop column cleaning_staff_name,
  add column manager_user_id  uuid references auth.users(id) on delete set null,
  add column meter_user_id    uuid references auth.users(id) on delete set null,
  add column cleaning_user_id uuid references auth.users(id) on delete set null,
  add column facilities        jsonb not null default '{}'::jsonb;
create index on buildings (org_id, manager_user_id);
create index on buildings (org_id, meter_user_id);
create index on buildings (org_id, cleaning_user_id);
```

- **레거시 유지**: `owner_name`·`owner_phone`·`entrance_password`·`memo`·`code`·`type_id`는 손대지 않는다. `memo`가 섹션5 참고사항.
- **`facilities` jsonb 형태**(고정 9키, 각 `{ "on": boolean, "memo": text }`):
  `cctv · elevator · cleaning · metering · management · septic · internet · electric_safety · fire_safety`
  (PRD상 청소/검침/관리담당이 섹션1 계정 담당자와 별개로 섹션2 시설체크에도 있는 것은 원문 그대로 반영. 시설체크는 "해당 항목 유무 + 메모" 의미.)

### 3.2 `building_customer_numbers` — 건물별 고객번호(유형별 복수)

```sql
create table building_customer_numbers (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  kind text not null check (kind in ('water','common_elec','elec','gas')),  -- 수도/공용전기/전기/가스
  customer_no text not null,
  meter_day int check (meter_day between 1 and 31),   -- 매월 N일
  billing_basis text not null default 'current' check (billing_basis in ('prev','current')),  -- 전월/당월
  print_on_bill boolean not null default true,        -- 고지서 출력 Y/N
  holder_name text,                                   -- 명의자
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on building_customer_numbers (building_id);
```

> 소비처(후속): 검침담당자 필터 엑셀의 **검침일 오름차순** 정렬(§7), P5 검침·부과.

### 3.3 `building_vendors` — 건물별 협력업체(계약서 파일)

```sql
create table building_vendors (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  vendor_type text not null check (vendor_type in ('elevator','fire','electric','septic','etc')),  -- 승강기/소방안전/전기안전/정화조/기타
  name text not null,
  phone text,
  memo text,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on building_vendors (building_id);
```

- 계약서 파일: 기존 `attachments`(`entity_type='building_vendor'`, `entity_id=building_vendors.id`, `kind='contract'`). 수 제한 없음.

### 3.4 updated_at 트리거 + 소프트삭제 확장

```sql
do $$ declare t text; begin
  foreach t in array array['building_customer_numbers','building_vendors'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- 건물 소프트삭제에 신규 자식 포함(기존 units·occupancies 로직 유지 + 확장)
create or replace function soft_delete_building(p_id bigint)
returns void language sql set search_path = public as $$
  update occupancies o set deleted_at = now()
    from units u where u.id = o.unit_id and u.building_id = p_id and o.deleted_at is null;
  update units set deleted_at = now() where building_id = p_id and deleted_at is null;
  update building_customer_numbers set deleted_at = now() where building_id = p_id and deleted_at is null;
  update building_vendors          set deleted_at = now() where building_id = p_id and deleted_at is null;
  update buildings set deleted_at = now() where id = p_id and deleted_at is null;
$$;
```

---

## 4. 통합 저장 RPC — `save_building` (결정 A)

```sql
create or replace function save_building(
  p_id          bigint,           -- null = 신규
  p_code        text,             -- 빈 문자열/ null → 자동 생성
  p_name        text,
  p_address     text,
  p_manager_user_id  uuid,
  p_meter_user_id    uuid,
  p_cleaning_user_id uuid,
  p_facilities  jsonb,            -- 9키 오브젝트
  p_memo        text,
  p_customer_numbers jsonb,       -- [{id?, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, sort_order, _deleted?}]
  p_vendors     jsonb             -- [{id?, client_key?, vendor_type, name, phone, memo, sort_order, _deleted?}]
) returns jsonb                   -- { building_id, vendors:[{client_key, id}] }
language plpgsql security definer set search_path = public as $$ ... $$;
```

**책임(트랜잭션 1회, 원자적)**
1. `v_org := current_user_org()`; `current_user_has_module('buildings')` 아니면 예외(권한 상승 방지·현장직원 차단). org는 서버에서 파생(클라 신뢰 안 함).
2. 건물 insert/update. `p_id is null`이고 `p_code` 비면 `B####` 자동 생성(org 내 유일). 담당자 FK는 **호출자 org 구성원인지 검증** 후 세팅(무효 uuid는 null 처리).
3. 자식 동기화(고객번호·협력업체): `id` 있으면 update, 없으면 insert, `_deleted=true`면 soft-delete. 유효성(enum·필수) 위반 예외.
4. 신규 협력업체는 `client_key`↔새 `id` 매핑을 결과 jsonb로 반환 → 클라이언트가 보류 중이던 파일을 해당 vendor id로 업로드.
5. (선택) `audit_log`에 `BUILDING_SAVE` 기록 — P3a 필수 아님, 후속.

**파일 처리(비원자, 후속 업로드)**: 구조화 데이터만 RPC로 원자 저장. 협력업체 계약서 파일은 File 객체 특성상 Storage 업로드가 필요 → 폼 상태에 File을 보관했다가 **save 성공 후** 반환된 vendor id로 `attachments` 업로드(§6.4, `longTermRepair` 미러). 수정 모드의 기존 파일은 즉시 조회/삭제. 파일 업로드 실패는 데이터 저장과 분리되어 재시도 가능(토스트 안내).

> **대안(미채택) B안**: 클라이언트 순차 오케스트레이션(건물→자식). 단순하나 중간 실패 시 부분저장 → PRD "통합 저장" 위배.

---

## 5. RLS — module-permission (`buildings`) (결정 F)

```sql
alter table building_customer_numbers enable row level security;
alter table building_vendors          enable row level security;

-- 신규 자식: SELECT는 소속 org 건물 범위 개방, 쓰기는 buildings 모듈
create policy bcn_select on building_customer_numbers for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy bcn_write on building_customer_numbers for all
  using      (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'));
-- building_vendors 동일 패턴(bv_select / bv_write)
```

**`buildings` 쓰기 조이기(현장직원 차단, DB 강제)** — 기존 개방 `bld_all`을 select-개방/write-`buildings` 게이트로 교체:

```sql
drop policy bld_all on buildings;
create policy bld_select on buildings for select using (org_id in (select my_org_ids()));
create policy bld_write  on buildings for all
  using      (org_id in (select my_org_ids()) and current_user_has_module('buildings'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('buildings'));
```

- **SELECT 개방 근거**: 담당자 필터·드롭다운·(향후)모바일 조회가 읽어야 함. 쓰기만 게이트.
- `save_building`은 `security definer`이나 내부에서 `current_user_has_module('buildings')`를 명시 검증하므로 RLS 우회 없이 동일 게이트가 적용된다.
- **주의**: `units`·`occupancies`의 기존 정책은 P3a에서 손대지 않음(P3b에서 tenants 모듈로 재검토).

---

## 6. 데이터 계층 (reactquery)

하우스 컨벤션: 도메인별 `apis/keys/queries/mutations/index` + `apis.test`. snake↔camel 매핑은 `apis.ts`, 클라이언트 `createClient()`(anon, RLS 적용).

### 6.1 `buildings` 개편
- `Building` 인터페이스: `managerName/meterStaffName/cleaningStaffName` 제거 → `managerUserId/meterUserId/cleaningUserId: string|null`, `facilities: FacilitiesMap` 추가.
- `listBuildings({ search?, managerUserId?, meterUserId?, cleaningUserId?, page?, pageSize? })` → `{ rows, total }`(count 헤드). 정렬 `created_at` desc. 담당자 필터 = `.eq('manager_user_id', …)` 등.
- `getBuildingFull(id)` → 건물 + 고객번호 + 협력업체(+첨부) + 시설 조립(수정 모드 로드).
- `saveBuilding(payload)` → `.rpc('save_building', …)`, 반환 `{ buildingId, vendors:[{clientKey,id}] }`.
- `deleteBuilding(id)` → 기존 `soft_delete_building` RPC(변경 없음).

### 6.2 신규 `buildingCustomerNumbers` / `buildingVendors`
- 조회 전용 훅(폼 로드용) + 매퍼. 쓰기는 `save_building`이 담당하므로 개별 mutation 최소(조회·매퍼 위주). 독립 CRUD가 필요 없으면 `apis.ts` 매퍼 + `listByBuilding`만.

### 6.3 담당자 드롭다운
- 기존 `listAccounts({ type })`(P2a) 재사용. 활성 계정만, 유형은 `manager_staff`·`support_staff`(현장직원·세입자 제외). `queries.ts`에 `useStaffOptions()` 얇은 래퍼.

### 6.4 `attachments` 범용화
- `hooks/reactquery/attachments/apis.ts`: `longTermRepair`의 업로드/목록/삭제/서명URL을 `{ entityType, entityId, orgId, kind, file }`로 일반화.
  - `uploadAttachment` 경로 `${orgId}/${entityType}/${entityId}/${uuid}-${name}` → Storage 업로드 → `attachments` insert → 실패 시 remove 롤백.
  - `listAttachments(entityType, entityId)` / `deleteAttachment({id, path})` / `signedUrl(path)`.
- `building_vendors`가 `entity_type='building_vendor'`, `kind='contract'`로 소비. **`longTermRepair` 리팩터는 스코프 밖**(미러만, 공용화는 후속 회귀 최소화).

---

## 7. zod 스키마 — `components/forms/schema/`

- `building.ts` 개편: `code?`(자동생성 허용), `name.min(1)`, `address.min(1)`, `managerUserId/meterUserId/cleaningUserId: z.string().uuid().nullable().optional()`, `facilities`(9키 각 `{on:boolean, memo:z.string().optional()}` — 메모 길이 제한 없음), `memo: z.string().max(1000).optional()`. (레거시 필드 제거)
- `buildingCustomerNumber.ts`(신규): `kind∈{water,common_elec,elec,gas}`, `customerNo.min(1)`, `meterDay: int.min(1).max(31).optional()`, `billingBasis∈{prev,current}`, `printOnBill:boolean`, `holderName?`.
- `buildingVendor.ts`(신규): `vendorType∈{elevator,fire,electric,septic,etc}`, `name.min(1)`, `phone?`, `memo?`.
- 폼 전체 스키마 `buildingFormSchema`: 위를 조합(고객번호·협력업체 배열 포함) → RPC payload 검증.

---

## 8. 페이지 & 컴포넌트

### 8.1 라우트
- `app/(staff)/staff/buildings/page.tsx` (`"use client"`, 목록) — **재작성**.
- `app/(staff)/staff/buildings/new/page.tsx` — 등록 모드(폼).
- `app/(staff)/staff/buildings/[id]/page.tsx` — 수정 모드(폼, `getBuildingFull` 로드).
- 게이트: `useMe()` → `hasModule(me,'buildings')` 아니면 접근 안내(현장직원·미권한 차단, `/setup` 게이트와 동형).

> **Next.js 주의(AGENTS.md)**: 동적 세그먼트 `[id]`·라우트 핸들러(§9)·`useRouter`/`redirect` 시그니처는 이 버전 규약이 다를 수 있으므로 구현 전 `node_modules/next/dist/docs/`를 확인한다.

### 8.2 컴포넌트
- `BuildingList`: `DataTable`(건물명/주소/관리·검침·청소담당자/총세대·입주세대) + 담당자 3필터(`Select`, 계정 옵션) + 필터초기화 + 페이지네이션(10/20/50) + `엑셀 다운`(§9) + `+ 건물 등록`. 행 더블클릭 → `router.push('/staff/buildings/'+id)`. 세대수는 `units`/`occupancies` 집계(읽기 전용; 개편은 P3b, P3a는 count만).
- `BuildingForm`(등록·수정 공용): 로컬 폼 상태(건물+고객번호[]+협력업체[]+시설+메모+보류파일[]). `저장` → `buildingFormSchema` 검증 → `saveBuilding` → 성공 시 보류 파일 업로드 → 토스트 → 수정 모드 유지/전환. `목록으로`는 dirty 시 이탈 확인.
  - `BasicInfoSection`: 코드/건물명/주소 + 담당자 3 `Select`(계정).
  - `FacilitiesSection`: 9행 `Checkbox` + 조건부 메모 `Input`.
  - `CustomerNumberSection`: 행 리스트(유형 `Select`/고객번호/검침일/부과기간/출력/명의자) + `+ 추가`/행 삭제.
  - `VendorSection`: 행 리스트(유형/업체명/전화/메모) + 계약서 업로드(썸네일·파일명·원본 signedUrl 보기·삭제) + `+ 추가`/행 삭제. 신규 행은 `client_key`로 파일 보류.
  - `MemoSection`: `textarea` + 잔여 글자수.

---

## 9. 엑셀 공통 유틸 (결정 3)

- **의존성**: `exceljs`(서버사이드 워크북 생성; SheetJS 대비 유지보수·스타일 우수). `package.json` 추가.
- **공통 유틸** `lib/export/xlsx.ts`: `rowsToXlsxBuffer(columns: {header,key,width?}[], rows: Record[])` → `Buffer`. 도메인 무관 재사용(P5·P6 대비).
- **라우트 핸들러** `app/api/buildings/export/route.ts`(GET): `lib/supabase/server.ts`로 RLS 적용 조회(쿼리 파라미터 = 목록 필터 그대로) → 컬럼(건물명·주소·관리/검침/청소담당자명·총세대수·입주세대수) → 검침담당자 필터가 있으면 **검침일 오름차순** 정렬(건물별 `building_customer_numbers.meter_day` **최솟값** 기준) → `Content-Disposition: attachment; filename="건물목록_YYYYMMDD.xlsx"`. 담당자명은 FK → `profiles.full_name` 조인.
- 파일명 날짜는 서버 로컬 기준 `YYYYMMDD`.

---

## 10. 테스트 전략 (TDD)

- **단위(Vitest)**:
  - `buildings/apis.test.ts`: snake↔camel(FK·facilities), 필터·페이지네이션 쿼리 구성, `saveBuilding` payload 매핑.
  - 신규 도메인 매퍼 테스트(customerNumbers·vendors·attachments 경로 규칙).
  - zod: `building.test.ts`(경계·enum·1000자·uuid), `buildingCustomerNumber.test.ts`, `buildingVendor.test.ts`.
  - `lib/export/xlsx.test.ts`: 컬럼·행 → 버퍼(비어있지 않음·시그니처), 빈 목록.
- **컴포넌트(RTL)**:
  - `page` 게이트: `buildings` 없음/있음/마스터 → 차단·허용.
  - `BuildingList`: 필터 변경·페이지 변경 시 쿼리 반영, 더블클릭 네비, 빈/결과없음 상태.
  - `BuildingForm`: 필수 검증(건물명·주소), 섹션 행 추가/삭제, 시설 체크→메모 활성, 저장 호출 payload, dirty 이탈 확인.
  - `VendorSection`: 파일 업로드/삭제 콜백, 신규행 client_key 보류.
- **RLS·RPC(SQL 검증, `supabase/verify/p3a_checks.sql`)**:
  - `buildings` 없는 구성원(현장직원): buildings/신규자식 **SELECT 가능 / INSERT·UPDATE 거부**. 보유·마스터: 쓰기 가능.
  - `save_building`: 신규 insert(코드 자동생성) + 자식 동기화(add/update/`_deleted`) + client_key 반환. 무권한 예외. 타 org 담당자 uuid → null 처리.
  - 신규 2테이블 **타 org 격리**.
  - `soft_delete_building` 확장(신규 자식까지 `deleted_at`).
- **정적**: `tsc --noEmit` + `npm run lint`.
- **라이브 미적용**: 원격 Supabase 미접속 환경 → 검증은 vitest + tsc + verify SQL 정적 리뷰. **런타임 적용·E2E는 사용자 PC 몫**(마이그레이션 순서: 0002→0003→0004).

---

## 11. 마이그레이션 / 환경

- `supabase/migrations/0004_p3a_buildings.sql`(§3·§4·§5 전부) + `supabase/verify/p3a_checks.sql`.
- **Storage**: 기존 `attachments` 버킷·정책(P1a `p1a_storage.sql`) 재사용. 신규 버킷 없음.
- **신규 env 없음**. 엑셀은 순수 서버 라이브러리(외부 연동 없음).
- **적용(사용자)**: `0004` 실행 → `p3a_checks.sql` 검증. **DB pending-user**(0002·0003 포함 미적용) — 순서 준수.

---

## 12. plan 단계화 (단일 plan, 3그룹)

> 마이그레이션은 `0004` 하나. 아래는 구현 태스크 순서. 각 태스크 TDD + 커밋(트레일러 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`).

1. **그룹1 — DB·데이터계층**: `0004`(buildings 변경 + 신규 2테이블 + RLS + `save_building` + soft-delete 확장) + `p3a_checks.sql` → `buildings` 훅 개편(FK·필터·페이지네이션·`getBuildingFull`·`saveBuilding`) + `buildingCustomerNumbers`·`buildingVendors`·`attachments` 도메인 + zod.
2. **그룹2 — 목록·엑셀**: `BuildingList`(필터·페이지네이션·더블클릭) + `exceljs`·`lib/export/xlsx.ts` + `app/api/buildings/export/route.ts`.
3. **그룹3 — 상세 폼**: `/new`·`/[id]` 페이지 + `BuildingForm` 5섹션(파일 업로드 포함) + dirty 이탈 확인 + 기존 모달·패널 컴포넌트 정리(제거/이관).

---

## 13. 열린 항목 / 향후

- **건물코드 UX** — 유지 + 자동생성 기본값(§결정 I). 자동생성 규칙(`B####` 시퀀스 vs 최대치+1)은 plan에서 확정.
- **정화조업체(`septic_vendors`) 드롭다운** — 협력업체 정화조 유형에서 P2b 마스터를 참조할지, 자유텍스트로 둘지 → 우선 자유텍스트(`building_vendors.name`), 마스터 연동은 후속.
- **총세대·입주세대 집계 성능** — 목록에서 건물별 count. 우선 뷰/서브쿼리, 대량 시 집계 컬럼/뷰 최적화는 후속.
- **엑셀 대량 다운 스트리밍** — 초기엔 버퍼 응답. 수천 행 이상이면 스트리밍 후속.
- **`attachments` 공용화(longTermRepair 포함 리팩터)** — 회귀 리스크로 후속.
- **입주자·세대 전체** — P3b.
- **감사로그 `BUILDING_SAVE`** — 필요 시 후속.

---

## 부록. PRD → P3a 배치

| PRD | 배치 |
|---|---|
| building-list 3.0 상단액션 | `BuildingList` 헤더(`+ 건물 등록`·`엑셀 다운`) |
| building-list 3.1 필터 | 담당자 3 `Select` + 초기화, 목록·엑셀 공통 반영 |
| building-list 3.2 테이블 | `DataTable` + 더블클릭 네비 + 페이지네이션(10/20/50, 기본20) |
| building-detail 3.0 헤더 | `BuildingForm` 모드분기 타이틀 + 통합 `저장` + `목록으로`(이탈확인) |
| building-detail 3.1 기본정보 | `BasicInfoSection` + 담당자 FK + `save_building` |
| building-detail 3.2 시설 | `FacilitiesSection` + `buildings.facilities` jsonb |
| building-detail 3.3 고객번호 | `CustomerNumberSection` + `building_customer_numbers` |
| building-detail 3.4 협력업체 | `VendorSection` + `building_vendors` + `attachments` |
| building-detail 3.5 참고사항 | `MemoSection` + `buildings.memo`(1000자) |
| tenant-list / tenant-detail | **P3b**(범위 밖) |
