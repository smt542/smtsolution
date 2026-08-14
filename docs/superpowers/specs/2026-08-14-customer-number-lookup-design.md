# 고객번호 조회 (독립 화면) — 설계

- 날짜: 2026-08-14
- 브랜치: `PracLee/marlin` (origin/master 4766ac0 기준)
- WBS: 사무실 관리자_고객번호 조회 (예정 → 신규 독립 화면)

## 1. 배경 / 현황

`building_customer_numbers`(마이그 `0004_p3a_buildings.sql`)는 건물 단위 고객번호(수도/공용전기/전기/가스)를 담는다: `id, building_id, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, sort_order, deleted_at`.

- 현재 UI: **건물 상세(완료)의 "고객번호" 섹션**(`app/(staff)/staff/buildings/components/sections/CustomerNumberSection.tsx`)에서 건물별 등록·수정만 가능. 건물 경계를 넘는 조회 화면은 **없음**.
- 데이터층 존재: `hooks/reactquery/buildingCustomerNumbers/`(apis·queries·keys·index) — 건물별 조회/저장. 스키마 zod: `components/forms/schema/buildingCustomerNumber.ts`.

이 슬라이스는 **건물 경계 없이 고객번호를 검색·일람하는 읽기 전용 화면**을 신설한다. PRD엔 독립 화면 정의가 없어 본 스펙이 정본.

## 2. 목표 / 비목표

### 목표
1. 신규 라우트 `/staff/customer-numbers` — org 내 건물들의 건물 고객번호를 **필터·검색·일람**(읽기 전용).
2. 필터: 건물 · 유형 · 텍스트(고객번호/명의자). 행 클릭 → 해당 건물 상세.
3. 현재 필터 결과 **엑셀 다운로드**.

### 비목표 (YAGNI)
- 세대 계량기 고객번호(`unit_meters.customer_no`) 통합 — 후속(범위 확장 시).
- 이 화면에서의 편집/등록 — 건물 상세 섹션이 담당.
- 담당자(assignee)별 필터 — 후속.
- 신규 테이블/RPC/마이그 — **없음**(기존 테이블 읽기만).

## 3. 라우트 · 네비게이션

- **신규 라우트**: `app/(staff)/staff/customer-numbers/page.tsx` → `/staff/customer-numbers`.
- **네비**: `components/shell/navItems.ts`에 항목 추가(라벨 "고객번호 조회"). ⚑ 아이콘·정렬은 인접 항목 패턴 따름.

## 4. 데이터층 (마이그 불필요, 기존 도메인 확장)

`hooks/reactquery/buildingCustomerNumbers/`에 **크로스빌딩 조회**를 추가한다.

- `apis.ts`: `listCustomerNumbers(filters)` 신규
  ```
  filters = { buildingId?: number|null; kind?: 'water'|'common_elec'|'elec'|'gas'|null; q?: string }
  ```
  PostgREST:
  ```
  from('building_customer_numbers')
    .select('id, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, building_id, buildings!inner(id, name)')
    .is('deleted_at', null)
    [.eq('building_id', buildingId)]         // 지정 시
    [.eq('kind', kind)]                       // 지정 시
    [.or(`customer_no.ilike.%${q}%,holder_name.ilike.%${q}%`)]  // q 있을 때
    .order('building_id').order('sort_order')
  ```
  - org 스코프는 `building_customer_numbers` RLS(→building→org)가 자동 처리. `buildings!inner`로 건물명 조인.
  - 반환 매퍼: `{ id, buildingId, buildingName, kind, customerNo, meterDay, billingBasis, printOnBill, holderName }`.
- `queries.ts`: `useCustomerNumberLookup(filters)` (React Query, filters 키에 포함).
- `keys.ts`: `customerNumberKeys.lookup(filters)` 추가.

## 5. 화면 구성 (`/staff/customer-numbers`)

```
CustomerNumberLookupPage
├─ 헤더(제목 + 엑셀 다운로드 버튼)
├─ 필터 바
│  ├─ 건물 Select (전체 / 특정)  — useBuildings 재사용
│  ├─ 유형 Select (전체/수도/공용전기/전기/가스)
│  └─ 텍스트 Input (고객번호 또는 명의자, debounce)
├─ 결과 테이블 (CustomerNumberLookupTable)
│  └─ 컬럼: 건물명 · 유형(한글 라벨) · 고객번호 · 명의자 · 검침일 · 부과기준(전월/당월) · 고지서출력(Y/N)
│  └─ 행 클릭 → /staff/buildings/{buildingId} (고객번호 섹션)
└─ 빈/로딩/에러 표준 상태
```

- 유형 한글 라벨: water=수도, common_elec=공용전기, elec=전기, gas=가스. billing_basis: prev=전월, current=당월. print_on_bill: true=Y/false=N.
- ⚑ **엑셀 다운로드**: 현재 필터 결과를 XLSX로. 기존 검침대장(`api/utilities/ledger` + exceljs) 패턴 재사용 — 서버 라우트 `app/api/customer-numbers/export/route.ts` 또는 클라 exceljs 중 기존 패턴에 맞춤(구현 시 확정).

## 6. 권한 · RLS

- ⚑ 건물/고객번호 read와 **동일 모듈 게이트**(구현 시 확인 — buildings 계열). 페이지 가드는 기존 staff 화면(`hasModule`) 패턴 재사용.
- RLS: `building_customer_numbers`(0004) 기존 org 스코프 정책이 조회를 자동 제한. 신규 정책 없음.

## 7. 테스트

- **apis (vitest)**: `listCustomerNumbers` 필터 조합(건물/유형/q/무필터)이 올바른 쿼리로 매핑되는지(기존 buildingCustomerNumbers apis.test 패턴/목킹 재사용). 매퍼 라운드트립(building_customer_numbers row → 뷰모델).
- **컴포넌트**: 필터 변경 반영, 테이블 렌더(한글 라벨·Y/N), 행 클릭 시 올바른 건물 경로 네비.
- **회귀**: 기존 `buildingCustomerNumbers` 건물별 경로 불변.
- 게이트: vitest 전건 pass · `tsc` 0 · `lint` 0.

## 8. 확정된 기본값 (결정 로그)

- ⚑ 라우트 = `/staff/customer-numbers`.
- ⚑ 엑셀 다운로드 **포함**(기존 XLSX 패턴).
- ⚑ 행 클릭 = 건물 상세 이동(읽기 전용, 편집은 그쪽).
- ⚑ 데이터층 = 기존 `buildingCustomerNumbers` 도메인 확장(신규 도메인 폴더 안 만듦).
- ⚑ 세대 계량기 고객번호·담당자 필터 = 비목표(후속).

## 9. 규모 · 파일

**신규**: `app/(staff)/staff/customer-numbers/page.tsx`, 컴포넌트 `CustomerNumberLookupTable.tsx`(+필터바 인라인 또는 분리), (엑셀) `app/api/customer-numbers/export/route.ts`(패턴에 따라).
**수정**: `hooks/reactquery/buildingCustomerNumbers/{apis,queries,keys}.ts`, `components/shell/navItems.ts`.
**마이그**: 없음.

규모 = 소~중. 순수 프론트 + 읽기 데이터층.

## 관련
- 데이터 정본: `supabase/migrations/0004_p3a_buildings.sql`(building_customer_numbers).
- 기존 도메인: `hooks/reactquery/buildingCustomerNumbers/`, `CustomerNumberSection.tsx`.
- 후속 슬라이스: 항목등록 관리(별도 사이클).
