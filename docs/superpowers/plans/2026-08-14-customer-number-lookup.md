# 고객번호 조회 (독립 화면) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 실행은 사용자 CLAUDE.md 라우팅에 따라 **codex-worker 스킬로 태스크별 위임**(Claude=오케스트레이터/리뷰어). 각 태스크는 독립 테스트 가능 산출물로 끝나며 체크박스(`- [ ]`)로 추적.

**Goal:** `/staff/customer-numbers` 신규 화면에서 org 내 건물들의 건물 고객번호(수도/공용전기/전기/가스)를 건물 경계 없이 필터·검색·일람(읽기 전용)하고 엑셀로 내려받는다.

**Architecture:** 신규 테이블/RPC/마이그 없음. 기존 `building_customer_numbers`(0004)를 PostgREST로 읽고(org RLS 자동 스코프, `buildings!inner`로 건물명 조인), 기존 `hooks/reactquery/buildingCustomerNumbers/` 도메인에 크로스빌딩 조회 쿼리를 확장. UI는 필터 바 + 테이블 + 엑셀 다운로드.

**Tech Stack:** Next.js(버전 확인: `node_modules/next/dist/docs/`), Supabase(PostgREST), TypeScript, React Query, exceljs(엑셀).

## Global Constraints

- 테이블 `building_customer_numbers` 컬럼: `id, building_id, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, sort_order, deleted_at`.
- `kind` ∈ **water/common_elec/elec/gas**(한글: 수도/공용전기/전기/가스). `billing_basis` ∈ **prev/current**(전월/당월). `print_on_bill` bool(Y/N).
- **마이그·RPC·신규 정책 없음** — 읽기 전용. org 스코프는 기존 RLS가 처리.
- 데이터층은 **기존 `hooks/reactquery/buildingCustomerNumbers/` 확장**(신규 도메인 폴더 금지). 기존 건물별 경로 회귀 금지.
- 라우트 `/staff/customer-numbers`. 페이지 가드는 기존 staff 화면 `hasModule` 패턴 재사용(건물 read와 동일 모듈).
- 게이트: 각 태스크 종료 시 `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run` pass. node_modules 있음 → codex가 직접 실행.
- 커밋 말미: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- AGENTS.md: 코드 전 `node_modules/next/dist/docs/` 관련 가이드 확인.

## File Structure

**신규**
- `app/(staff)/staff/customer-numbers/page.tsx` — 필터 상태 + 조회 + 테이블 조립.
- `app/(staff)/staff/customer-numbers/components/CustomerNumberLookupTable.tsx` — 결과 테이블(+필터바 인라인 또는 분리).
- `app/api/customer-numbers/export/route.ts` — 엑셀(서버 라우트, 기존 `api/utilities/ledger` 패턴이 서버면 동일; 클라 exceljs 패턴이면 그쪽 따름).

**수정**
- `hooks/reactquery/buildingCustomerNumbers/apis.ts` — `listCustomerNumbers` 추가.
- `hooks/reactquery/buildingCustomerNumbers/queries.ts` — `useCustomerNumberLookup` 추가.
- `hooks/reactquery/buildingCustomerNumbers/keys.ts` — `lookup` 키 추가.
- `components/shell/navItems.ts` — "고객번호 조회" 항목.

**태스크 의존:** 1(데이터층) → 2(화면) → 3(엑셀). 순차.

---

## Task 1: 데이터층 — 크로스빌딩 조회 확장

**Files:**
- Read first: `hooks/reactquery/buildingCustomerNumbers/{apis,queries,keys,index}.ts`(기존 패턴·createClient·매퍼·반환 타입), `hooks/reactquery/buildingCustomerNumbers/apis.test.ts`(목킹 하니스).
- Modify: 위 apis.ts·queries.ts·keys.ts.
- Test: `hooks/reactquery/buildingCustomerNumbers/apis.test.ts`.

**Interfaces:**
- Produces:
  ```
  type CustomerNumberKind = 'water'|'common_elec'|'elec'|'gas';
  interface CustomerNumberFilters { buildingId?: number|null; kind?: CustomerNumberKind|null; q?: string }
  interface CustomerNumberLookupRow {
    id:number; buildingId:number; buildingName:string; kind:CustomerNumberKind;
    customerNo:string; meterDay:number|null; billingBasis:'prev'|'current';
    printOnBill:boolean; holderName:string|null;
  }
  listCustomerNumbers(filters: CustomerNumberFilters): Promise<CustomerNumberLookupRow[]>
  useCustomerNumberLookup(filters: CustomerNumberFilters)  // React Query
  ```

- [ ] **Step 1: 기존 패턴 확인** apis.ts의 createClient·select·매퍼·에러처리와 apis.test.ts 목킹 방식을 읽는다.

- [ ] **Step 2: 실패 테스트 작성** `apis.test.ts`에 `listCustomerNumbers` 케이스: (a) 무필터 → deleted_at null·정렬 쿼리, (b) buildingId+kind 지정 → eq 필터, (c) q 지정 → `or(customer_no.ilike,holder_name.ilike)`, (d) row→CustomerNumberLookupRow 매퍼(buildings 조인명→buildingName). 기존 목킹 패턴으로.

- [ ] **Step 3: 실패 확인** Run: `npx vitest run hooks/reactquery/buildingCustomerNumbers/apis.test.ts` → FAIL(미정의).

- [ ] **Step 4: 구현** apis.ts에 추가:
  ```ts
  export async function listCustomerNumbers(filters: CustomerNumberFilters): Promise<CustomerNumberLookupRow[]> {
    let query = createClient()
      .from('building_customer_numbers')
      .select('id, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, building_id, buildings!inner(id, name)')
      .is('deleted_at', null);
    if (filters.buildingId != null) query = query.eq('building_id', filters.buildingId);
    if (filters.kind) query = query.eq('kind', filters.kind);
    const q = filters.q?.trim();
    if (q) query = query.or(`customer_no.ilike.%${q}%,holder_name.ilike.%${q}%`);
    const { data, error } = await query.order('building_id').order('sort_order');
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as CustomerNumberDbRow[]).map((r) => ({
      id: r.id, buildingId: r.building_id, buildingName: r.buildings?.name ?? '',
      kind: r.kind, customerNo: r.customer_no, meterDay: r.meter_day,
      billingBasis: r.billing_basis, printOnBill: r.print_on_bill, holderName: r.holder_name,
    }));
  }
  ```
  (CustomerNumberDbRow 타입은 snake_case + `buildings:{name:string}` 로 선언.) keys.ts에 `lookup: (f: CustomerNumberFilters) => ['building-customer-numbers','lookup',f] as const`. queries.ts에 `useCustomerNumberLookup(filters)` = useQuery(key=lookup(filters), fn=listCustomerNumbers(filters)).

- [ ] **Step 5: 통과 확인** Run: `npx vitest run hooks/reactquery/buildingCustomerNumbers/apis.test.ts` → PASS.

- [ ] **Step 6: 게이트+커밋** `npx tsc --noEmit` 0 · `npm run lint` 0.
  ```bash
  git add hooks/reactquery/buildingCustomerNumbers/
  git commit -m "feat(customer-numbers): 크로스빌딩 조회 데이터층(listCustomerNumbers·useCustomerNumberLookup)"
  ```

---

## Task 2: 화면 — 페이지 + 필터바 + 테이블 + 네비

**Files:**
- Read first: 유사 조회 화면 1개(예: `app/(staff)/staff/**` 중 미납/utilities처럼 필터바+테이블 있는 페이지 — `rg -l "useBuildings" app/\(staff\)`로 후보), 공통 `Select`/`Input`/`EmptyState`/`Spinner`(`@/components/common`), `components/shell/navItems.ts`, `hooks/reactquery/buildings`(useBuildings).
- Create: `app/(staff)/staff/customer-numbers/page.tsx`, `app/(staff)/staff/customer-numbers/components/CustomerNumberLookupTable.tsx`.
- Modify: `components/shell/navItems.ts`.
- Test: `app/(staff)/staff/customer-numbers/page.test.tsx`, `.../components/CustomerNumberLookupTable.test.tsx`.

**Interfaces:**
- Consumes: Task 1 `useCustomerNumberLookup`, `CustomerNumberLookupRow`, `CustomerNumberFilters`.

- [ ] **Step 1: 패턴 확인** 유사 필터바+테이블 페이지와 공통 컴포넌트, navItems 구조, useBuildings 반환형을 읽는다.

- [ ] **Step 2: 실패 테스트 작성**
  (a) `CustomerNumberLookupTable.test.tsx`: rows 주면 건물명·유형 한글(water→수도 등)·부과기준(prev→전월)·고지서출력(true→Y) 렌더, 행 클릭 시 `onRowClick(row)` 호출.
  (b) `page.test.tsx`: 유형 Select 변경 시 필터 반영(useCustomerNumberLookup 호출 인자), 로딩/빈 상태. 기존 페이지 테스트 목킹 패턴 미러.

- [ ] **Step 3: 실패 확인** Run: `npx vitest run app/\(staff\)/staff/customer-numbers` → FAIL.

- [ ] **Step 4: 구현**
  - `CustomerNumberLookupTable.tsx`: props `{ rows: CustomerNumberLookupRow[]; onRowClick:(r)=>void }`. 컬럼 건물명·유형(라벨맵)·고객번호·명의자·검침일·부과기준(전월/당월)·고지서출력(Y/N). 라벨맵 `{water:'수도',common_elec:'공용전기',elec:'전기',gas:'가스'}`, `{prev:'전월',current:'당월'}`.
  - `page.tsx`: 필터 상태(buildingId/kind/q, q는 debounce), `useBuildings`로 건물 Select, `useCustomerNumberLookup(filters)`. 헤더에 엑셀 버튼 자리(Task 3에서 연결). 행 클릭 → `router.push('/staff/buildings/'+row.buildingId)`. 로딩=Spinner·빈=EmptyState·에러 표준. 페이지 가드 기존 staff 패턴.
  - `navItems.ts`: "고객번호 조회" → `/staff/customer-numbers` 항목 추가(인접 항목 아이콘/순서 패턴).

- [ ] **Step 5: 통과 확인** Run: `npx vitest run app/\(staff\)/staff/customer-numbers` → PASS.

- [ ] **Step 6: 게이트+커밋** `tsc` 0 · `lint` 0 · 전체 `vitest` pass.
  ```bash
  git add "app/(staff)/staff/customer-numbers" components/shell/navItems.ts
  git commit -m "feat(customer-numbers): /staff/customer-numbers 조회 화면·필터·테이블·네비"
  ```

---

## Task 3: 엑셀 다운로드

**Files:**
- Read first: 기존 XLSX 내보내기(`rg -l "exceljs" app lib` — 특히 검침대장 `api/utilities/ledger` 라우트 또는 클라 생성기)와 그 호출부(다운로드 버튼 방식).
- Create/Modify: 기존 패턴이 **서버 라우트**면 `app/api/customer-numbers/export/route.ts` 신규 + page 버튼 연결. **클라 exceljs**면 동일 유틸 패턴으로 생성 + 버튼.
- Test: 기존 엑셀 테스트 있으면 미러(워크북 시트/헤더/행 매핑).

**Interfaces:**
- Consumes: Task 1 `listCustomerNumbers(filters)`(서버 라우트에서 재사용하거나 동등 쿼리), Task 2 필터 상태.

- [ ] **Step 1: 패턴 확인** 검침대장 엑셀 구현(서버/클라)·헤더 구성·파일명·인증(RLS/service) 방식을 읽는다.

- [ ] **Step 2: 실패 테스트 작성** 엑셀 생성 함수가 현재 필터 결과를 헤더(건물명·유형·고객번호·명의자·검침일·부과기준·고지서출력)와 행으로 만드는지(기존 엑셀 테스트 패턴). 라이브 DB 필요 라우트면 순수 워크북 빌더만 유닛테스트하고 그 사실을 명기.

- [ ] **Step 3: 실패 확인** Run: `npx vitest run <엑셀 테스트>` → FAIL.

- [ ] **Step 4: 구현** 검침대장과 동일 방식으로 고객번호 조회 결과 XLSX 생성(유형/부과기준/고지서출력은 한글·Y/N 변환). page 헤더 다운로드 버튼을 현재 필터로 연결.

- [ ] **Step 5: 통과 확인** Run: `npx vitest run <엑셀 테스트>` → PASS.

- [ ] **Step 6: 게이트+커밋** `tsc` 0 · `lint` 0 · `vitest` pass.
  ```bash
  git add "app/(staff)/staff/customer-numbers" app/api/customer-numbers
  git commit -m "feat(customer-numbers): 조회 결과 엑셀 다운로드"
  ```

---

## Self-Review

**1. Spec coverage:** §3 라우트·네비→Task2. §4 데이터층(listCustomerNumbers·hook·keys)→Task1. §5 필터바·테이블·행클릭→Task2, 엑셀→Task3. §6 권한·RLS→Task2 가드(기존 RLS 재사용). §7 테스트→각 태스크 테스트 스텝. §2 비목표(세대 계량기·담당자·편집·마이그)=미구현 유지. 갭 없음.

**2. Placeholder scan:** "TBD/적절히" 없음. 컴포넌트·엑셀은 정확 경로 대신 **탐색 명령**으로 기존 패턴 확정(Codex가 레포 탐색). 지어낸 코드 없음(데이터층 쿼리는 실코드).

**3. Type consistency:** `CustomerNumberKind`·`CustomerNumberFilters`·`CustomerNumberLookupRow`·`listCustomerNumbers`·`useCustomerNumberLookup` Task1 정의 후 Task2/3 동일 사용. kind/billing_basis 값·라벨맵 일관.

## Notes
- 스펙: `docs/superpowers/specs/2026-08-14-customer-number-lookup-design.md`.
- 마이그 없음 → 라이브 DB 작업 없음.
- 커밋 후 WBS 동기화(`wbs-commit-sync`, "고객번호 조회" 페이지 dev).
