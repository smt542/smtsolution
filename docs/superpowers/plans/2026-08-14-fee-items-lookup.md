# 항목등록 관리 (읽기 전용 조회) Implementation Plan

> **For agentic workers:** 이 계획은 **Codex 워커에 위임** 실행한다(Claude=오케스트레이터/리뷰어). 각 Task를 순서대로 구현·검증하고, **커밋은 Claude가 diff 리뷰 후** 수행한다(Codex는 샌드박스라 git 불가). 스텝은 `- [ ]` 체크박스로 추적.

**Goal:** org 전체 건물유형의 관리비 항목(`fee_items`)을 필터·검색·일람하는 읽기 전용 화면 `/staff/fee-items` + 엑셀 다운로드를 신설한다. 편집은 기존 항목관리 모달이 유지.

**Architecture:** `2026-08-14-customer-number-lookup-design.md`/customer-numbers 슬라이스의 **구조적 클론**. 기존 `hooks/reactquery/feeItems/` 도메인에 크로스유형 조회(`listAllFeeItems`)를 추가하고, customer-numbers와 동일한 서버 XLSX export 라우트·페이지·테이블 패턴을 fee_items 필드로 치환한다. 신규 테이블/RPC/마이그레이션 **없음**.

**Tech Stack:** Next.js(app router, 비표준 버전 — 아래 제약 참조), React Query(@tanstack/react-query), Supabase(PostgREST, RLS), exceljs(`@/lib/export/xlsx`), vitest + @testing-library.

## Global Constraints

- **Next.js 비표준 버전**: Next 코드(라우트 핸들러/페이지) 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인(AGENTS.md 지시). `app/(staff)/staff/*` prefix, route handler는 `route.ts`의 `export async function GET`.
- **마이그레이션 없음**: `fee_items`/`building_types`(0001) 기존 스키마 읽기 전용. 신규 SQL 금지.
- **org 스코프는 RLS**: `fee_items` RLS(`fi_all`, org_id 기준)가 조회를 자동 제한. 코드에서 org 필터 추가 금지.
- **유형 이름 컬럼 = `building_types.label`** (NOT `name`). 뷰모델 필드명은 `typeLabel`.
- **회귀 금지**: 기존 `listFeeItems(typeId)`·mutations·항목관리 모달 경로 불변.
- **게이트(모든 Task 커밋 전)**: `npx vitest run` 전건 pass · `npx tsc --noEmit` 0 · `npm run lint` 0.
- **DRY/YAGNI/TDD**: 테스트 먼저. 4개짜리 라벨 상수는 customer-numbers 패턴대로 workbook·테이블에 각각 정의(과한 공용화 안 함).
- **읽기 전용**: 행 클릭 네비게이션 없음(편집 홈인 모달이 route 주소화 불가).

## Reference (미러링 대상 — Codex가 실제 파일을 읽어 구조 복제)

- 데이터층 미러: `hooks/reactquery/buildingCustomerNumbers/{apis,queries,keys,index}.ts` (특히 `listCustomerNumbers`, `useCustomerNumberLookup`).
- 확장 대상: `hooks/reactquery/feeItems/{apis,keys,queries,index}.ts` + 테스트 `hooks/reactquery/feeItems/apis.test.ts`.
- export 미러: `app/api/customer-numbers/export/{route,workbook,workbook.test}.ts`.
- 페이지/테이블 미러: `app/(staff)/staff/customer-numbers/page.tsx`, `.../components/CustomerNumberLookupTable.tsx`, 테스트 `page.test.tsx`·`components/CustomerNumberLookupTable.test.tsx`.
- 유틸: `lib/export/xlsx.ts`(`rowsToXlsxBuffer`, `XlsxColumn`), `useBuildingTypes` (`@/hooks/reactquery/buildingTypes` → `{id, orgId, label, sortOrder}[]`), `useMe`/`hasModule`(`@/lib/auth/permissions`).
- 스펙 정본: `docs/superpowers/specs/2026-08-14-fee-items-lookup-design.md`.

## File Structure

**신규**
- `app/(staff)/staff/fee-items/page.tsx` — 조회 페이지(필터·테이블·엑셀버튼·권한가드).
- `app/(staff)/staff/fee-items/components/FeeItemLookupTable.tsx` — 결과 테이블(읽기 전용).
- `app/(staff)/staff/fee-items/components/FeeItemLookupTable.test.tsx` — 테이블 테스트.
- `app/(staff)/staff/fee-items/page.test.tsx` — 페이지 테스트.
- `app/api/fee-items/export/route.ts` — 서버 XLSX export(GET).
- `app/api/fee-items/export/workbook.ts` — 워크북 스키마 빌더.
- `app/api/fee-items/export/workbook.test.ts` — 워크북 테스트.

**수정**
- `hooks/reactquery/feeItems/apis.ts` — `FeeItemLookupFilters`·`FeeItemLookupRow` 타입 + `listAllFeeItems` 추가.
- `hooks/reactquery/feeItems/keys.ts` — `lookup(filters)` 키 추가.
- `hooks/reactquery/feeItems/queries.ts` — `useFeeItemLookup(filters)` 추가.
- `hooks/reactquery/feeItems/index.ts` — 신규 심볼·타입 re-export.
- `hooks/reactquery/feeItems/apis.test.ts` — `listAllFeeItems` 테스트 추가.
- `components/shell/navItems.ts` — "관리업무" 그룹에 nav 항목 추가.

---

### Task 1: 데이터층 — 크로스유형 조회 (`feeItems` 도메인 확장)

**Files:**
- Modify: `hooks/reactquery/feeItems/apis.ts`
- Modify: `hooks/reactquery/feeItems/keys.ts`
- Modify: `hooks/reactquery/feeItems/queries.ts`
- Modify: `hooks/reactquery/feeItems/index.ts`
- Test: `hooks/reactquery/feeItems/apis.test.ts`

**Interfaces:**
- Produces (later tasks/UI가 사용):
  - `FeeItemLookupFilters = { typeId?: number | null; required?: boolean | null; q?: string }`
  - `FeeItemLookupRow = { id: number; typeId: number; typeLabel: string; name: string; rounding: string; dailyProration: boolean; carryOver: boolean; isRequired: boolean; sortOrder: number }`
  - `listAllFeeItems(filters: FeeItemLookupFilters): Promise<FeeItemLookupRow[]>`
  - `useFeeItemLookup(filters: FeeItemLookupFilters)` → React Query result of `FeeItemLookupRow[]`
  - `feeItemKeys.lookup(filters)`
- Consumes: 기존 `createClient`(`@/lib/supabase/client`), 기존 `feeItemKeys`.

- [ ] **Step 1: 실패 테스트 작성** — `hooks/reactquery/feeItems/apis.test.ts`에 `listAllFeeItems` describe 추가. 기존 이 파일(및 `buildingCustomerNumbers/apis.test.ts`)의 Supabase 목킹 패턴을 그대로 재사용한다. 다음 케이스를 커버(구체 단언):
  - **무필터**: `from("fee_items")` 호출, `.select(...)`에 `building_types!inner(id, label)` 포함, `.is("deleted_at", null)`, `.order("type_id")`+`.order("sort_order")` 호출. `.eq`/`.ilike` 미호출.
  - **typeId 지정**: `.eq("type_id", 7)` 호출.
  - **required=true**: `.eq("is_required", true)` 호출. **required=false**: `.eq("is_required", false)` 호출. **required=null/undefined**: `is_required` eq 미호출.
  - **q 지정**: `.ilike("name", "%관리%")` 호출. **q 공백/빈문자**: ilike 미호출(trim 후 빈값).
  - **매퍼**: mock이 `{ id:1, type_id:7, name:"일반관리비", rounding:"round", daily_proration:false, carry_over:true, is_required:true, sort_order:0, building_types:{ label:"원룸텔" } }` 반환 시 → `{ id:1, typeId:7, typeLabel:"원룸텔", name:"일반관리비", rounding:"round", dailyProration:false, carryOver:true, isRequired:true, sortOrder:0 }`. `building_types`가 null이면 `typeLabel:""`.

- [ ] **Step 2: 실패 확인**
  Run: `npx vitest run hooks/reactquery/feeItems/apis.test.ts`
  Expected: FAIL (`listAllFeeItems is not a function` 등).

- [ ] **Step 3: 구현** — `apis.ts`에 아래 추가(기존 export 유지):
```ts
export interface FeeItemLookupFilters {
  typeId?: number | null;
  required?: boolean | null;
  q?: string;
}

export interface FeeItemLookupRow {
  id: number;
  typeId: number;
  typeLabel: string;
  name: string;
  rounding: string;
  dailyProration: boolean;
  carryOver: boolean;
  isRequired: boolean;
  sortOrder: number;
}

type FeeItemLookupDbRow = {
  id: number;
  type_id: number;
  name: string;
  rounding: string;
  daily_proration: boolean;
  carry_over: boolean;
  is_required: boolean;
  sort_order: number;
  building_types: { label: string } | null;
};

export async function listAllFeeItems(filters: FeeItemLookupFilters): Promise<FeeItemLookupRow[]> {
  let query = createClient()
    .from("fee_items")
    .select(
      "id, type_id, name, rounding, daily_proration, carry_over, is_required, sort_order, building_types!inner(id, label)",
    )
    .is("deleted_at", null);
  if (filters.typeId != null) query = query.eq("type_id", filters.typeId);
  if (filters.required != null) query = query.eq("is_required", filters.required);
  const q = filters.q?.trim();
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, error } = await query.order("type_id").order("sort_order");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FeeItemLookupDbRow[]).map((r) => ({
    id: r.id,
    typeId: r.type_id,
    typeLabel: r.building_types?.label ?? "",
    name: r.name,
    rounding: r.rounding,
    dailyProration: r.daily_proration,
    carryOver: r.carry_over,
    isRequired: r.is_required,
    sortOrder: r.sort_order,
  }));
}
```
  `keys.ts`에 추가:
```ts
export const feeItemKeys = {
  all: ["feeItems"] as const,
  list: (typeId: number) => ["feeItems", "list", typeId] as const,
  lookup: (filters: import("./apis").FeeItemLookupFilters) =>
    ["feeItems", "lookup", filters] as const,
};
```
  `queries.ts`에 추가(기존 `useFeeItems` 유지):
```ts
import { listAllFeeItems, type FeeItemLookupFilters } from "./apis";
// ...
export function useFeeItemLookup(filters: FeeItemLookupFilters) {
  return useQuery({
    queryKey: feeItemKeys.lookup(filters),
    queryFn: () => listAllFeeItems(filters),
  });
}
```
  `index.ts`: `buildingCustomerNumbers/index.ts` re-export 스타일에 맞춰 `listAllFeeItems`, `useFeeItemLookup`, 타입 `FeeItemLookupRow`·`FeeItemLookupFilters`를 추가 노출.

- [ ] **Step 4: 통과 확인**
  Run: `npx vitest run hooks/reactquery/feeItems/apis.test.ts`
  Expected: PASS (신규 케이스 + 기존 feeItems 테스트 불변).

- [ ] **Step 5: 타입·린트**
  Run: `npx tsc --noEmit` → 0 / `npm run lint` → 0.

- [ ] **Step 6: 커밋** *(Claude가 diff 리뷰 후)*
```
feat(fee-items): 크로스유형 관리비 항목 조회 데이터층(listAllFeeItems)
```

---

### Task 2: 엑셀 export (서버 라우트 + 워크북)

**Files:**
- Create: `app/api/fee-items/export/workbook.ts`
- Create: `app/api/fee-items/export/route.ts`
- Test: `app/api/fee-items/export/workbook.test.ts`

**Interfaces:**
- Consumes: `FeeItemLookupRow`(Task 1, `@/hooks/reactquery/feeItems`), `rowsToXlsxBuffer`·`XlsxColumn`(`@/lib/export/xlsx`), `createClient`(`@/lib/supabase/server`).
- Produces: `buildFeeItemWorkbookData(rows: FeeItemLookupRow[]): { columns: XlsxColumn[]; rows: Record<string, unknown>[] }`; GET `/api/fee-items/export?typeId&required&q` → XLSX.

- [ ] **Step 1: 실패 테스트 작성** — `workbook.test.ts` (customer-numbers `workbook.test.ts` 패턴). 단언:
  - `columns`가 순서대로 header `["건물유형","항목명","반올림","일할계산","이월","필수","정렬순서"]`, key `["typeLabel","name","rounding","dailyProration","carryOver","isRequired","sortOrder"]`.
  - 입력 row `{ typeLabel:"원룸텔", name:"일반관리비", rounding:"round", dailyProration:true, carryOver:false, isRequired:true, sortOrder:2, ... }` → 출력 row `{ typeLabel:"원룸텔", name:"일반관리비", rounding:"반올림", dailyProration:"Y", carryOver:"N", isRequired:"필수", sortOrder:2 }`.
  - rounding 라벨: `up→올림, round→반올림, down→내림, raw→원값`. isRequired: `true→필수, false→선택`.

- [ ] **Step 2: 실패 확인**
  Run: `npx vitest run app/api/fee-items/export/workbook.test.ts` → FAIL.

- [ ] **Step 3: 워크북 구현** — `workbook.ts`:
```ts
import type { FeeItemLookupRow } from "@/hooks/reactquery/feeItems";
import type { XlsxColumn } from "@/lib/export/xlsx";

const ROUNDING_LABELS: Record<string, string> = {
  up: "올림",
  round: "반올림",
  down: "내림",
  raw: "원값",
};

interface FeeItemWorkbookData {
  columns: XlsxColumn[];
  rows: Record<string, unknown>[];
}

export function buildFeeItemWorkbookData(rows: FeeItemLookupRow[]): FeeItemWorkbookData {
  return {
    columns: [
      { header: "건물유형", key: "typeLabel", width: 18 },
      { header: "항목명", key: "name", width: 24 },
      { header: "반올림", key: "rounding", width: 10 },
      { header: "일할계산", key: "dailyProration", width: 10 },
      { header: "이월", key: "carryOver", width: 8 },
      { header: "필수", key: "isRequired", width: 8 },
      { header: "정렬순서", key: "sortOrder", width: 10 },
    ],
    rows: rows.map((row) => ({
      typeLabel: row.typeLabel,
      name: row.name,
      rounding: ROUNDING_LABELS[row.rounding] ?? row.rounding,
      dailyProration: row.dailyProration ? "Y" : "N",
      carryOver: row.carryOver ? "Y" : "N",
      isRequired: row.isRequired ? "필수" : "선택",
      sortOrder: row.sortOrder,
    })),
  };
}
```

- [ ] **Step 4: 통과 확인**
  Run: `npx vitest run app/api/fee-items/export/workbook.test.ts` → PASS.

- [ ] **Step 5: 라우트 구현** — `route.ts` (customer-numbers route 미러; 서버 client, 파라미터 검증→400, 동일 쿼리, 파일명 한글+ASCII fallback):
```ts
import type { FeeItemLookupRow } from "@/hooks/reactquery/feeItems";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";
import { createClient } from "@/lib/supabase/server";
import { buildFeeItemWorkbookData } from "./workbook";

type FeeItemDbRow = {
  id: number;
  type_id: number;
  name: string;
  rounding: string;
  daily_proration: boolean;
  carry_over: boolean;
  is_required: boolean;
  sort_order: number;
  building_types: { label: string } | null;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const typeIdParam = params.get("typeId");
  const typeId = typeIdParam === null ? null : Number(typeIdParam);
  const requiredParam = params.get("required"); // "true" | "false" | null

  if (
    (typeId !== null && (!Number.isSafeInteger(typeId) || typeId <= 0))
    || (requiredParam !== null && requiredParam !== "true" && requiredParam !== "false")
  ) {
    return Response.json({ error: "invalid fee-item export parameters" }, { status: 400 });
  }

  const sb = await createClient();
  let query = sb
    .from("fee_items")
    .select(
      "id, type_id, name, rounding, daily_proration, carry_over, is_required, sort_order, building_types!inner(id, label)",
    )
    .is("deleted_at", null);

  if (typeId !== null) query = query.eq("type_id", typeId);
  if (requiredParam !== null) query = query.eq("is_required", requiredParam === "true");
  const q = params.get("q")?.trim();
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query.order("type_id").order("sort_order");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as unknown as FeeItemDbRow[]).map<FeeItemLookupRow>((row) => ({
    id: row.id,
    typeId: row.type_id,
    typeLabel: row.building_types?.label ?? "",
    name: row.name,
    rounding: row.rounding,
    dailyProration: row.daily_proration,
    carryOver: row.carry_over,
    isRequired: row.is_required,
    sortOrder: row.sort_order,
  }));
  const workbook = buildFeeItemWorkbookData(rows);
  const buffer = await rowsToXlsxBuffer(workbook.columns, workbook.rows);

  const now = new Date();
  const ymd = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const filename = `관리비항목_${ymd}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="fee_items_${ymd}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
```

- [ ] **Step 6: 타입·린트**
  Run: `npx tsc --noEmit` → 0 / `npm run lint` → 0.

- [ ] **Step 7: 커밋** *(Claude 리뷰 후)*
```
feat(fee-items): 조회 결과 엑셀 다운로드(서버 export 라우트)
```

---

### Task 3: 조회 페이지 + 테이블 + 네비 등록

**Files:**
- Create: `app/(staff)/staff/fee-items/page.tsx`
- Create: `app/(staff)/staff/fee-items/components/FeeItemLookupTable.tsx`
- Test: `app/(staff)/staff/fee-items/page.test.tsx`
- Test: `app/(staff)/staff/fee-items/components/FeeItemLookupTable.test.tsx`
- Modify: `components/shell/navItems.ts`

**Interfaces:**
- Consumes: `useFeeItemLookup`·`FeeItemLookupRow`(Task 1), `useBuildingTypes`, `useMe`/`hasModule`, GET `/api/fee-items/export`(Task 2).
- Produces: 라우트 `/staff/fee-items`; `FeeItemLookupTable` 컴포넌트(props: `{ rows: FeeItemLookupRow[] }` — **onClick/네비 없음**).

**미러 지침:** `page.tsx`는 `app/(staff)/staff/customer-numbers/page.tsx`를, `FeeItemLookupTable.tsx`는 `.../components/CustomerNumberLookupTable.tsx`를, 각 테스트는 대응 테스트 파일을 **구조 그대로 복제**하고 아래 치환/차이만 적용한다.

**필드/라벨 치환**
- 필터: 건물 Select→**건물유형 Select**(`useBuildingTypes`, 옵션 라벨 = `label`, value = `id`, "전체" 포함) · 유형(kind) Select→**필수여부 Select**(전체/`required=true`=필수/`required=false`=선택) · 텍스트 검색(항목명, **debounce 300ms**, customer-numbers와 동일 방식).
- hook 호출: `useFeeItemLookup({ typeId, required, q: debouncedQ })`.
- 테이블 컬럼(7): 건물유형(`typeLabel`) · 항목명(`name`) · 반올림(`ROUNDING_LABELS`) · 일할계산(Y/N) · 이월(Y/N) · 필수(`필수/선택`) · 정렬순서(`sortOrder`). 라벨 상수(`ROUNDING_LABELS = { up:"올림", round:"반올림", down:"내림", raw:"원값" }`)는 테이블 컴포넌트에 로컬 정의(Task 2 workbook과 동일 값, customer-numbers처럼 중복 허용).
- **행 클릭 = 없음**: customer-numbers의 `onClick`/`useRouter` 네비 및 role/tabIndex/키보드 핸들러 **제거**. 정적 read-only 행.
- 권한 가드: `hasModule(me, "buildings")` → **`hasModule(me, "billing")`**.
- 엑셀 URL 빌더: `customerNumberExportUrl`→`feeItemExportUrl(filters)` — `typeId`(있을 때), `required`(true/false 문자열, 있을 때), `q`(trim 후 있을 때)를 `/api/fee-items/export`에 직렬화. 다운로드 트리거(앵커/버튼)는 customer-numbers와 동일.

- [ ] **Step 1: 실패 테이블 테스트** — `FeeItemLookupTable.test.tsx` (`CustomerNumberLookupTable.test.tsx` 미러). 2행(하나는 `rounding:"round", dailyProration:true, carryOver:false, isRequired:true`, 다른 하나는 `rounding:"raw", dailyProration:false, carryOver:true, isRequired:false`) 렌더 → 셀에 `반올림/원값`, `Y/N`, `필수/선택`, `typeLabel`, `name` 표시 단언. **행 클릭 콜백/네비 없음**(customer-numbers의 onClick 테스트는 제거).

- [ ] **Step 2: 실패 확인**
  Run: `npx vitest run app/(staff)/staff/fee-items/components/FeeItemLookupTable.test.tsx` → FAIL.

- [ ] **Step 3: 테이블 구현** — `FeeItemLookupTable.tsx` (미러 + 위 치환).

- [ ] **Step 4: 통과 확인**
  Run: `npx vitest run app/(staff)/staff/fee-items/components/FeeItemLookupTable.test.tsx` → PASS.

- [ ] **Step 5: 실패 페이지 테스트** — `page.test.tsx` (`customer-numbers/page.test.tsx` 미러). Mock: `useMe`(billing 권한 보유), `useBuildingTypes`(`[{ id:1, orgId:10, label:"원룸텔", sortOrder:0 }]`), `useFeeItemLookup`. 케이스:
  - 필수여부 필터 변경 시 `useFeeItemLookup`가 `required` 갱신값으로 호출.
  - 로딩/빈 상태 렌더.
  - 텍스트 입력 debounce(타이머 advance) 후 `feeItemExportUrl`이 `typeId`·`required`·`q`를 올바르게 직렬화(엑셀 링크 href 단언).
  - 권한 없음(`hasModule` false) → "권한이 없습니다" `EmptyState`.
  - **행 클릭 네비 테스트 없음**.

- [ ] **Step 6: 실패 확인**
  Run: `npx vitest run app/(staff)/staff/fee-items/page.test.tsx` → FAIL.

- [ ] **Step 7: 페이지 구현** — `page.tsx` (미러 + 위 치환: 건물유형/필수여부/항목명 필터, `feeItemExportUrl`, billing 가드, 행 클릭 제거).

- [ ] **Step 8: 네비 등록** — `components/shell/navItems.ts`의 "관리업무" 그룹에서 **"관리비 부과셋팅"(management-fee) 항목 바로 다음**에 삽입(둘 다 `module:"billing"` 관리비 도메인):
```ts
{ label: "항목등록 관리", href: "/staff/fee-items", module: "billing", built: true, icon: "M4 6h16M4 12h10M4 18h7M17 14l2 2 4-4" },
```
  (아이콘 path는 인접 항목 스타일의 24×24 stroke; 위 값 사용 가능.)

- [ ] **Step 9: 통과 + 게이트**
  Run: `npx vitest run app/(staff)/staff/fee-items/page.test.tsx` → PASS.
  Run: `npx tsc --noEmit` → 0 / `npm run lint` → 0.

- [ ] **Step 10: 커밋** *(Claude 리뷰 후)*
```
feat(fee-items): 항목등록 관리 조회 화면 + 네비 등록
```

---

### Task 4: 최종 검증 게이트 (전건)

- [ ] **Step 1: 전체 테스트**
  Run: `npx vitest run` → 전건 PASS(기존 + 신규). 기존 feeItems 모달 경로 회귀 없음 확인.
- [ ] **Step 2: 타입·린트 전체**
  Run: `npx tsc --noEmit` → 0 / `npm run lint` → 0.
- [ ] **Step 3: 수동 스모크(선택)** — `npm run dev` → `/staff/fee-items`: 필터·검색·엑셀 다운로드·권한가드 동작 확인.

---

## Self-Review (작성자 점검)

**1. 스펙 커버리지** (스펙 §별 → Task 매핑)
- §2 목표1(라우트·일람) → Task 3. 목표2(필터 3종) → Task 3. 목표3(엑셀) → Task 2.
- §4 데이터층(listAllFeeItems/useFeeItemLookup/keys.lookup) → Task 1.
- §5 화면(필터바·7컬럼·행클릭없음·상태) → Task 3.
- §6 권한(billing 가드·RLS) → Task 3(가드) + Global Constraints(RLS).
- §7 엑셀(route·workbook·파일명·URL빌더) → Task 2 + Task 3(feeItemExportUrl).
- §8 테스트(apis·컴포넌트·워크북·회귀) → Task 1·2·3 + Task 4 회귀.
- §10 파일(신규/수정/마이그없음) → File Structure 일치.
- 갭: 없음.

**2. 플레이스홀더 스캔**: TBD/TODO 없음. 데이터층·워크북·라우트·네비는 완전 코드. 페이지/테이블/테스트는 in-repo 구체 파일 미러 + 치환표(가짜 참조 아님).

**3. 타입 일관성**: `FeeItemLookupRow`/`FeeItemLookupFilters` 필드·시그니처가 Task 1 정의 → Task 2(route/workbook import) → Task 3(hook 호출)에서 동일. `building_types.label`·`typeLabel` 일관. `feeItemExportUrl` param(`typeId/required/q`) ↔ route 파싱 일치. rounding 라벨 값 Task 2 workbook ↔ Task 3 테이블 동일(`올림/반올림/내림/원값`).

## 관련
- 스펙: `docs/superpowers/specs/2026-08-14-fee-items-lookup-design.md`
- 형제: `docs/superpowers/plans`(customer-numbers 계획 부재 시 슬라이스 자체가 레퍼런스), `2026-08-14-customer-number-lookup-design.md`
