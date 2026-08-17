# 항목등록 관리 (읽기 전용 조회) — 설계

- 날짜: 2026-08-14
- 브랜치: `PracLee/mackerel` (origin/master `8acfb5d` 기준)
- WBS: 사무실 관리자_항목등록 관리 (예정 → 신규 독립 화면)
- 형제 스펙: `2026-08-14-customer-number-lookup-design.md` (동일 패턴, 이 슬라이스가 후속)

## 1. 배경 / 현황

`fee_items`(마이그 `0001_p1a_master_data.sql:44`)는 건물유형(`building_types`) 단위 관리비 항목 마스터다: `id, org_id, type_id, name, rounding(enum up/round/down/raw), daily_proration, carry_over, is_required, sort_order, deleted_at, created_at, updated_at`, `unique(type_id, name)`.

- 현재 UI: **관리비 화면(`/staff/management-fee`)의 "항목관리 모달"**(`app/(staff)/staff/management-fee/components/ItemManageModal.tsx`)에서 등록·수정·삭제·정렬(CRUD) 가능. 단, **건물 → 건물유형을 먼저 선택해야만 접근**되며 건물유형 경계를 넘는 통합 조회 화면은 **없음**.
- 데이터층 존재: `hooks/reactquery/feeItems/`(apis·queries·keys·mutations·index) — `listFeeItems(typeId)`(유형 단위 조회) + create/update/delete/reorder mutations. 폼 zod: `components/forms/schema/feeItem.ts`.
- 조인 대상 `building_types`(`0001:5`): `id, org_id, label, sort_order`, `unique(org_id, label)`. **이름 컬럼은 `label`**(not `name`). 조회 훅 `useBuildingTypes()`(`@/hooks/reactquery/buildingTypes`) → `{ id, orgId, label, sortOrder }[]` 존재.

이 슬라이스는 **건물유형 경계 없이 org 전체 관리비 항목을 검색·일람하는 읽기 전용 화면**을 신설한다. 편집은 기존 모달이 계속 담당한다. PRD엔 독립 조회 화면 정의가 없어(모달만 기술) 본 스펙이 정본. `2026-08-14-customer-number-lookup-design.md`의 구조적 클론이다.

## 2. 목표 / 비목표

### 목표
1. 신규 라우트 `/staff/fee-items` — org 내 모든 건물유형의 관리비 항목을 **필터·검색·일람**(읽기 전용).
2. 필터: 건물유형 · 필수여부(필수/선택) · 텍스트(항목명).
3. 현재 필터 결과 **엑셀 다운로드**.

### 비목표 (YAGNI)
- 이 화면에서의 편집/등록/삭제/정렬 — 기존 항목관리 모달이 담당.
- 행 클릭 네비게이션 — 편집 홈인 모달이 건물→유형 선택을 요구해 route로 주소화 불가(§5 참조).
- `fee_item_charges`(세대×항목×기간 부과 실적) 통합 — 부과확정 슬라이스 소관.
- 신규 테이블/RPC/마이그 — **없음**(기존 테이블 읽기만).

## 3. 라우트 · 네비게이션

- **신규 라우트**: `app/(staff)/staff/fee-items/page.tsx` → `/staff/fee-items`.
- **네비**: `components/shell/navItems.ts`에 항목 추가 — 라벨 "항목등록 관리", href `/staff/fee-items`, module 게이트 **`"billing"`**(관리비 마스터이므로 management-fee와 동일 계열; customer-numbers의 `buildings`와 다른 지점), built=true. 아이콘·정렬·그룹 배치는 인접 항목 패턴(customer-numbers 인근, 둘 다 크로스경계 조회) 따름.

## 4. 데이터층 (마이그 불필요, 기존 도메인 확장)

`hooks/reactquery/feeItems/`에 **크로스유형(org 전체) 조회**를 추가한다. 기존 `listFeeItems(typeId)`·mutations는 **불변**.

- `apis.ts`: `listAllFeeItems(filters)` 신규
  ```
  filters = { typeId?: number|null; required?: boolean|null; q?: string }
  ```
  PostgREST:
  ```
  from('fee_items')
    .select('id, type_id, name, rounding, daily_proration, carry_over, is_required, sort_order, building_types!inner(id, label)')
    .is('deleted_at', null)
    [.eq('type_id', typeId)]        // 지정 시
    [.eq('is_required', required)]  // 지정 시 (true=필수 / false=선택)
    [.ilike('name', `%${q}%`)]      // q 있을 때 (항목명)
    .order('type_id').order('sort_order')
  ```
  - org 스코프는 `fee_items` RLS(`fi_all`, org_id 기준)가 자동 처리. `building_types!inner`로 유형 라벨 조인.
  - 반환 매퍼: `{ id, typeId, typeLabel, name, rounding, dailyProration, carryOver, isRequired, sortOrder }` (뷰모델 `FeeItemLookupRow`). rounding은 enum 원값 유지(한글 라벨은 UI에서).
- `queries.ts`: `useFeeItemLookup(filters)` (React Query, filters 키 포함).
- `keys.ts`: `feeItemKeys.lookup(filters)` 추가.

## 5. 화면 구성 (`/staff/fee-items`)

```
FeeItemLookupPage
├─ 헤더(제목 + 엑셀 다운로드 버튼)
├─ 필터 바
│  ├─ 건물유형 Select (전체 / 특정)  — useBuildingTypes 재사용 (label 표시)
│  ├─ 필수여부 Select (전체 / 필수 / 선택)
│  └─ 텍스트 Input (항목명, debounce 300ms)
├─ 결과 테이블 (FeeItemLookupTable)
│  └─ 컬럼: 건물유형(label) · 항목명 · 반올림 · 일할계산(Y/N) · 이월(Y/N) · 필수(필수/선택) · 정렬순서
│  └─ 행 클릭 = 없음 (읽기 전용)
└─ 빈/로딩/에러 표준 상태
```

- 한글 라벨: rounding `up=올림 / round=반올림 / down=내림 / raw=원값`. daily_proration `true=Y / false=N`. carry_over `true=Y / false=N`(이월Y=다음달 자동이월). is_required `true=필수 / false=선택`.
- **행 클릭 = 없음**: customer-numbers는 행클릭→건물상세(편집 홈)였으나, 이 화면의 편집 홈(항목관리 모달)은 건물→유형 선택을 요구해 route로 주소화 불가. 따라서 읽기 전용 일람만 제공하며 이것이 customer-numbers와 유일한 구조적 차이다.
- **엑셀 다운로드**: 현재 필터 결과를 XLSX로. customer-numbers export(`@/lib/export/xlsx`의 `rowsToXlsxBuffer` + `workbook.ts` 빌더 + 서버 GET 라우트) 패턴 재사용.

## 6. 권한 · RLS

- 페이지 가드: 기존 staff 화면 패턴(`useMe()` + `hasModule(me, "billing")`) 재사용. 권한 없으면 표준 `EmptyState`("권한이 없습니다"), 로딩 시 `Spinner`.
- RLS: `fee_items`(0001) 기존 org 스코프 정책(`fi_all`)이 조회를 자동 제한. 신규 정책 없음.

## 7. 엑셀 다운로드 상세

- 서버 라우트 `app/api/fee-items/export/route.ts`(GET) — 파라미터(typeId 안전 정수, required boolean, q 텍스트) 검증 후 §4와 동일 쿼리 실행.
- 워크북 스키마 `app/api/fee-items/export/workbook.ts`: 컬럼 = 건물유형 · 항목명 · 반올림 · 일할계산 · 이월 · 필수 · 정렬순서(적정 너비). enum 한글 라벨은 UI와 공유(중복 정의 최소화 — 라벨 상수 공용화 검토).
- 반환: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, 파일명 `관리비항목_YYYYMMDD.xlsx`(UTF-8 + ASCII fallback).
- 클라이언트 URL 빌더 `feeItemExportUrl(filters)`가 typeId·required·q 직렬화.

## 8. 테스트

- **apis (vitest)**: `listAllFeeItems` 필터 조합(유형/필수/q/무필터)이 올바른 쿼리로 매핑되는지(기존 `feeItems/apis.test.ts` 목킹 패턴 재사용). 매퍼 라운드트립(fee_items row + building_types.label → 뷰모델).
- **컴포넌트**: 필터 변경 반영, 테이블 렌더(한글 라벨: 반올림/Y-N/필수·선택), 엑셀 URL 직렬화(debounce advance).
- **워크북**: `buildFeeItemWorkbookData` 컬럼·라벨·순서(customer-numbers `workbook.test.ts` 패턴).
- **회귀**: 기존 `feeItems` 모달 경로(`listFeeItems`/mutations) 불변.
- 게이트: vitest 전건 pass · `tsc` 0 · `lint` 0.

## 9. 확정된 기본값 (결정 로그)

- ✅ 라우트 = `/staff/fee-items`.
- ✅ module 게이트 = `billing`.
- ✅ 필터 = 건물유형 · 필수여부(필수/선택) · 텍스트(항목명).
- ✅ 행 클릭 = 없음(읽기 전용). 편집은 기존 항목관리 모달.
- ✅ 유형 이름 조인 = `building_types.label`(뷰모델 `typeLabel`).
- ✅ 엑셀 다운로드 포함(customer-numbers XLSX 패턴).
- ✅ 데이터층 = 기존 `feeItems` 도메인 확장(신규 폴더 안 만듦).

## 10. 규모 · 파일

**신규**: `app/(staff)/staff/fee-items/page.tsx`, 컴포넌트 `FeeItemLookupTable.tsx`(+필터바 인라인 또는 분리), (엑셀) `app/api/fee-items/export/route.ts` + `workbook.ts`(+테스트).
**수정**: `hooks/reactquery/feeItems/{apis,queries,keys}.ts`, `components/shell/navItems.ts`.
**마이그**: 없음.

규모 = 소~중. 순수 프론트 + 읽기 데이터층.

## 관련
- 데이터 정본: `supabase/migrations/0001_p1a_master_data.sql`(fee_items, building_types).
- 기존 도메인: `hooks/reactquery/feeItems/`, `ItemManageModal.tsx`(편집 홈), `useBuildingTypes`.
- 형제 슬라이스: 고객번호 조회(`2026-08-14-customer-number-lookup-design.md`, 동일 패턴).
