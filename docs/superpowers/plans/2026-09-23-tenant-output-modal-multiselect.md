# 출력 모달 다중 선택·미리보기 정본 정합(1단계) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/staff/buildings`의 입주자카드·부과내역 출력 모달을 정본 `#printModal`처럼 여러 건물을 골라 이어 붙여 미리 보고, 선택한 건물 전부를 정본 순서로 인쇄하게 만든다.

**Architecture:** 선택 건물마다 기존 쿼리 3개를 `useQueries`로 병렬 조회하는 훅(`useTenantOutputData`)을 만들고, 순수 함수(`outputPages.ts`)가 그 결과를 미리보기·인쇄용 페이지 배열로 펼친다. 모달은 선택 상태(Set)만 들고, 목록(`BuildingPickerList`)·문서 카드(`PreviewPane`)는 정본 마크업·값으로 다시 그린다. 종이 안 문서는 현재 앱 문서를 그대로 축소해 넣는다(양식 교체는 2단계).

**Tech Stack:** Next.js 16(App Router) · React 19 · TypeScript · Tailwind CSS v4 · `@tanstack/react-query` v5 · Supabase

**Spec:** `docs/superpowers/specs/2026-09-23-tenant-output-modal-multiselect-design.md`

## Global Constraints

- 작업 트리: 워크트리 `C:\Users\leebj\orca\workspaces\home_erp\pinfish`(브랜치 `PracLee/pinfish`). master 체크아웃(`C:\Users\leebj\orca\projects\home_erp`)은 여러 세션이 공유하므로 직접 편집 금지. 커밋은 **내가 바꾼 파일만** `git add`.
- **단위 테스트 금지**(회사 정책: 프론트 테스트는 E2E만, vitest 없음). 각 태스크 검증 = `tsc --noEmit` + ESLint, 동작 검증 = Task 6 헤드리스 점검.
- 워크트리엔 node_modules가 없다. 검증 전 정션 연결, 끝나면 **반드시 제거**:
  - 연결(PowerShell): `New-Item -ItemType Junction -Path C:\Users\leebj\orca\workspaces\home_erp\pinfish\node_modules -Target C:\Users\leebj\orca\projects\home_erp\node_modules`
  - 제거(PowerShell): `cmd /c rmdir C:\Users\leebj\orca\workspaces\home_erp\pinfish\node_modules`
  - tsc: `node ./node_modules/typescript/bin/tsc --noEmit` (`npm run`·`npx` 금지 — 전역으로 끌려감). `.next[/\\]` 경로 오류는 dev 서버 부산물이라 제외하고 센다.
  - ESLint: `node ./node_modules/eslint/bin/eslint.js <파일들>`
- 서버 상태는 React Query만(`useState`·`useEffect`에 API 응답 복제 금지). 기존 query key·API 함수를 재사용해 캐시를 공유한다.
- UI는 Tailwind, 공용 컴포넌트 재사용(`Button`·`Spinner`·`CustomDropdown`). 공용 컴포넌트 파일은 이 계획에서 바꾸지 않는다(`components/icons`에 아이콘 추가만).
- 정본 줄간격: 고정 높이가 없는 텍스트는 `leading-[normal]`(Tailwind `leading-normal`=1.5는 틀림).
- 문구는 정본 그대로: "건물 전체", "N곳 선택", "검색 결과가 없어요", "건물을 선택해 주세요", "{건물명} 선택됨 · 카드 X장 · 내역서 Y장", "N곳 선택됨 · 카드 X장 · 내역서 Y장", "왼쪽에서 건물을 선택해 주세요", "입주자카드와 관리비부과내역서 미리보기가 좌우로 표시돼요".
- 버튼(취소·둘 다 인쇄 등 `.hf-btn` 계열) hover는 건드리지 않는다(미결정 사항, 앱 공용 Button 동작 유지).

## Review Focus

태스크 코드로는 드러나지 않지만 실제 사용에서 문제가 되기 쉬운 입력·상황 5가지. 각각 Task 6에 점검(RF1~RF5)을 넣었다.

- **RF1 일부 건물만 조회 완료**: 여러 곳을 고른 직후 한 건물의 데이터가 늦게 오면, 그 패널은 로딩으로 보이고 인쇄 버튼은 막혀야 한다(일부 건물이 빠진 인쇄 방지).
- **RF2 검색으로 좁힌 상태에서 건물 전체**: 보이는 건물이 아니라 전체 목록이 선택되고, "N곳 선택"도 전체 기준이어야 한다.
- **RF3 선택을 모두 해제**: 빈 미리보기·"건물을 선택해 주세요"·둘 다 인쇄 비활성으로 돌아가야 한다.
- **RF4 연·월 변경으로 쪽수가 줄어듦**: 보던 쪽이 없어지면 마지막 쪽(0장이면 빈 상태)으로 당겨져야 하고, 존재하지 않는 쪽을 가리키면 안 된다.
- **RF5 한 건물 조회 실패**: 다른 건물이 성공해도 그 패널은 실패 문구를 보이고 그 문서 인쇄가 막혀야 한다.

---

## 파일 구조

| 파일 | 작업 | 책임 |
|---|---|---|
| `hooks/reactquery/bill/useTenantOutputData.ts` | 생성 | 선택 건물별 3개 쿼리 병렬 조회 + 패널 상태 |
| `hooks/reactquery/bill/index.ts` | 수정 | 새 훅 export |
| `app/(staff)/staff/(app)/buildings/components/tenant-output/outputPages.ts` | 생성 | 조회 결과 → 미리보기·인쇄 페이지 배열, 상태 병합, 인쇄 순서, 하단 문구 |
| `app/(staff)/staff/(app)/buildings/components/tenant-output/BuildingPickerList.tsx` | 수정(전체 교체) | 다중 선택 목록(체크박스·건물 전체) |
| `components/icons/IdCardIcon.tsx`, `components/icons/DocumentIcon.tsx`, `components/icons/index.ts` | 생성·수정 | 정본 문서 카드 헤더·빈 상태 아이콘 |
| `app/(staff)/staff/(app)/buildings/components/tenant-output/PreviewPane.tsx` | 수정(전체 교체) | 정본 문서 카드(헤더·건물 줄·페이지 줄·종이) |
| `app/(staff)/staff/(app)/buildings/components/TenantOutputModal.tsx` | 수정(전체 교체) | 선택 상태·조회·미리보기·하단·인쇄 연결 |
| `app/(staff)/staff/(app)/buildings/components/BuildingTenantManager.tsx` | 수정 | `initialBuildingId` 전달 제거 |

---

### Task 1: 다중 건물 조회 훅 `useTenantOutputData`

**Files:**
- Create: `hooks/reactquery/bill/useTenantOutputData.ts`
- Modify: `hooks/reactquery/bill/index.ts`

**Interfaces:**
- Consumes: `occupancyKeys.tenantCardPrint(id)`·`getTenantCardPrintData(id)`·`TenantCardRow`(`@/hooks/reactquery/occupancies`), `billKeys.targets(id, period)`·`listBillTargets(id, period)`·`billKeys.documents(id, period, unitIds)`·`getBillDocuments(id, period, unitIds)`·`BillDocument`(`./apis`, `./keys`)
- Produces:
  - `export type OutputQueryStatus = "loading" | "error" | "ready"`
  - `export interface TenantOutputBuildingData { buildingId: number; tenants: TenantCardRow[]; cardStatus: OutputQueryStatus; documents: BillDocument[]; statementStatus: OutputQueryStatus }`
  - `export function useTenantOutputData(buildingIds: number[], period: string): TenantOutputBuildingData[]` — 반환 순서 = `buildingIds` 순서

- [ ] **Step 1: 훅 파일 작성**

`hooks/reactquery/bill/useTenantOutputData.ts`:

```ts
import { useQueries } from "@tanstack/react-query";
import { getTenantCardPrintData, occupancyKeys, type TenantCardRow } from "@/hooks/reactquery/occupancies";
import { getBillDocuments, listBillTargets, type BillDocument } from "./apis";
import { billKeys } from "./keys";

/** 출력 모달 패널 하나의 조회 상태. */
export type OutputQueryStatus = "loading" | "error" | "ready";

export interface TenantOutputBuildingData {
  buildingId: number;
  tenants: TenantCardRow[];
  cardStatus: OutputQueryStatus;
  documents: BillDocument[];
  statementStatus: OutputQueryStatus;
}

/**
 * 입주자카드·부과내역 출력 모달 — 선택한 건물마다 입주자카드 인쇄 데이터·부과 대상·부과 문서를 병렬 조회한다.
 * 단일 건물 훅(useTenantCardPrintData·useBillTargets·useBillDocuments)과 같은 query key·API라 캐시를 공유한다
 * (선례: useAdjustmentStatements). 반환 순서 = buildingIds 순서.
 */
export function useTenantOutputData(buildingIds: number[], period: string): TenantOutputBuildingData[] {
  const cardQueries = useQueries({
    queries: buildingIds.map((buildingId) => ({
      queryKey: occupancyKeys.tenantCardPrint(buildingId),
      queryFn: () => getTenantCardPrintData(buildingId),
      // 원문 연락처가 담긴 응답이므로 화면을 벗어나면 캐시에 남기지 않는다(useTenantCardPrintData와 같다).
      gcTime: 0,
    })),
  });
  const targetQueries = useQueries({
    queries: buildingIds.map((buildingId) => ({
      queryKey: billKeys.targets(buildingId, period),
      queryFn: () => listBillTargets(buildingId, period),
    })),
  });
  const documentQueries = useQueries({
    queries: buildingIds.map((buildingId, index) => {
      const unitIds = (targetQueries[index]?.data ?? []).map((target) => target.unitId);
      return {
        queryKey: billKeys.documents(buildingId, period, unitIds),
        queryFn: () => getBillDocuments(buildingId, period, unitIds),
        enabled: unitIds.length > 0,
      };
    }),
  });

  // 콜백 반환 타입을 명시해야 상태 리터럴이 string으로 넓혀지지 않는다.
  return buildingIds.map((buildingId, index): TenantOutputBuildingData => {
    const card = cardQueries[index];
    const target = targetQueries[index];
    const document = documentQueries[index];
    const hasUnits = (target?.data?.length ?? 0) > 0;
    return {
      buildingId,
      tenants: card?.data ?? [],
      cardStatus: card?.isError ? "error" : card?.isPending ? "loading" : "ready",
      documents: hasUnits ? (document?.data ?? []) : [],
      // 부과 대상이 없으면 문서 쿼리는 꺼져 있어(pending·idle) 로딩으로 치지 않는다.
      statementStatus:
        target?.isError || (hasUnits && document?.isError)
          ? "error"
          : target?.isPending || (hasUnits && document?.isPending)
            ? "loading"
            : "ready",
    };
  });
}
```

- [ ] **Step 2: 배럴 export 추가**

`hooks/reactquery/bill/index.ts` 마지막 줄 아래에 추가:

```ts
export * from "./useTenantOutputData";
```

- [ ] **Step 3: 타입·린트 확인**

정션 연결 후 실행:

```bash
node ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep 'error TS' | grep -vE '\.next[/\\]'
node ./node_modules/eslint/bin/eslint.js hooks/reactquery/bill/useTenantOutputData.ts hooks/reactquery/bill/index.ts
```

Expected: 두 명령 모두 출력 없음(오류 0).

- [ ] **Step 4: 커밋**

```bash
git add hooks/reactquery/bill/useTenantOutputData.ts hooks/reactquery/bill/index.ts
git commit -m "feat(bill): 출력 모달용 다중 건물 조회 훅 useTenantOutputData"
```

---

### Task 2: 페이지 모델 `outputPages.ts`

**Files:**
- Create: `app/(staff)/staff/(app)/buildings/components/tenant-output/outputPages.ts`

**Interfaces:**
- Consumes: `OutputQueryStatus`·`TenantOutputBuildingData`(Task 1, `@/hooks/reactquery/bill`), `Building`(`@/hooks/reactquery/buildings`), `TenantCardRow`(`@/hooks/reactquery/occupancies`), `buildChargeStatement`·`paginate`·`StatementRow`(`./statement`)
- Produces:
  - `export const UNITS_PER_STATEMENT_PAGE = 14`
  - `export interface CardPage { key: string; building: Building; tenant: TenantCardRow; pageIndex: number; pageCount: number }`
  - `export interface StatementPage { key: string; building: Building; feeNames: string[]; rows: StatementRow[]; totals?: number[]; grandTotal?: number; pageIndex: number; pageCount: number }`
  - `export interface BuildingOutputPages { building: Building; cards: CardPage[]; statements: StatementPage[] }`
  - `export interface OutputPages { cards: CardPage[]; statements: StatementPage[]; cardStatus: OutputQueryStatus; statementStatus: OutputQueryStatus; byBuilding: BuildingOutputPages[] }`
  - `export function mergeStatus(statuses: OutputQueryStatus[]): OutputQueryStatus`
  - `export function buildOutputPages(selected: Building[], data: TenantOutputBuildingData[]): OutputPages`
  - `export type PrintScope = "both" | "card" | "statement"`
  - `export type PrintItem = { kind: "card"; page: CardPage } | { kind: "statement"; page: StatementPage }`
  - `export function printSequence(scope: PrintScope, pages: OutputPages): PrintItem[]`
  - `export function outputHint(selected: Building[], cardCount: number, statementCount: number): string`

- [ ] **Step 1: 파일 작성**

```ts
import type { OutputQueryStatus, TenantOutputBuildingData } from "@/hooks/reactquery/bill";
import type { Building } from "@/hooks/reactquery/buildings";
import type { TenantCardRow } from "@/hooks/reactquery/occupancies";
import { buildChargeStatement, paginate, type StatementRow } from "./statement";

/** 부과내역서 한 장에 싣는 세대 수(현재 문서 모델 — 2단계 양식에서 바뀔 수 있다). */
export const UNITS_PER_STATEMENT_PAGE = 14;

export interface CardPage {
  key: string;
  building: Building;
  tenant: TenantCardRow;
  /** 건물 안에서의 쪽 번호(0부터) — 문서 하단 쪽 표기용. */
  pageIndex: number;
  pageCount: number;
}

export interface StatementPage {
  key: string;
  building: Building;
  feeNames: string[];
  rows: StatementRow[];
  /** 그 건물의 마지막 장에만 합계를 싣는다. */
  totals?: number[];
  grandTotal?: number;
  pageIndex: number;
  pageCount: number;
}

export interface BuildingOutputPages {
  building: Building;
  cards: CardPage[];
  statements: StatementPage[];
}

export interface OutputPages {
  /** 미리보기용 — 선택 건물(목록 순서)의 입주자카드를 이어 붙인 배열. */
  cards: CardPage[];
  statements: StatementPage[];
  cardStatus: OutputQueryStatus;
  statementStatus: OutputQueryStatus;
  /** 인쇄용 — 건물별 묶음. */
  byBuilding: BuildingOutputPages[];
}

/** 하나라도 로딩이면 로딩, 실패가 있으면 실패, 아니면 준비(스펙 §5). */
export function mergeStatus(statuses: OutputQueryStatus[]): OutputQueryStatus {
  if (statuses.includes("loading")) return "loading";
  if (statuses.includes("error")) return "error";
  return "ready";
}

/** 선택 건물(목록 순서)과 건물별 조회 결과를 미리보기·인쇄용 페이지로 펼친다. */
export function buildOutputPages(selected: Building[], data: TenantOutputBuildingData[]): OutputPages {
  const dataById = new Map(data.map((entry) => [entry.buildingId, entry]));
  const byBuilding = selected.map((building): BuildingOutputPages => {
    const entry = dataById.get(building.id);
    const tenants = entry?.tenants ?? [];
    const cards = tenants.map((tenant, index) => ({
      key: `card-${building.id}-${tenant.unitId}`,
      building,
      tenant,
      pageIndex: index,
      pageCount: tenants.length,
    }));
    const statement = buildChargeStatement(entry?.documents ?? []);
    const chunks = paginate(statement.rows, UNITS_PER_STATEMENT_PAGE);
    const statements = chunks.map((rows, index) => {
      const last = index === chunks.length - 1;
      return {
        key: `statement-${building.id}-${index}`,
        building,
        feeNames: statement.feeNames,
        rows,
        totals: last ? statement.totals : undefined,
        grandTotal: last ? statement.grandTotal : undefined,
        pageIndex: index,
        pageCount: chunks.length,
      };
    });
    return { building, cards, statements };
  });
  return {
    cards: byBuilding.flatMap((entry) => entry.cards),
    statements: byBuilding.flatMap((entry) => entry.statements),
    cardStatus: mergeStatus(data.map((entry) => entry.cardStatus)),
    statementStatus: mergeStatus(data.map((entry) => entry.statementStatus)),
    byBuilding,
  };
}

export type PrintScope = "both" | "card" | "statement";
export type PrintItem = { kind: "card"; page: CardPage } | { kind: "statement"; page: StatementPage };

/** 인쇄 순서(스펙 §6·PDF): 둘 다 = 건물별 [카드 → 내역서], 카드만·내역서만 = 그 문서만 건물 순서대로. */
export function printSequence(scope: PrintScope, pages: OutputPages): PrintItem[] {
  return pages.byBuilding.flatMap((entry) => [
    ...(scope === "statement" ? [] : entry.cards.map((page) => ({ kind: "card" as const, page }))),
    ...(scope === "card" ? [] : entry.statements.map((page) => ({ kind: "statement" as const, page }))),
  ]);
}

/** 정본 `pmHint` 문구. */
export function outputHint(selected: Building[], cardCount: number, statementCount: number): string {
  if (selected.length === 0) return "건물을 선택해 주세요";
  const who = selected.length > 1 ? `${selected.length}곳 선택됨` : `${selected[0].name} 선택됨`;
  return `${who} · 카드 ${cardCount}장 · 내역서 ${statementCount}장`;
}
```

- [ ] **Step 2: 타입·린트 확인**

```bash
node ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep 'error TS' | grep -vE '\.next[/\\]'
node ./node_modules/eslint/bin/eslint.js "app/(staff)/staff/(app)/buildings/components/tenant-output/outputPages.ts"
```

Expected: 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add "app/(staff)/staff/(app)/buildings/components/tenant-output/outputPages.ts"
git commit -m "feat(buildings): 출력 모달 페이지 모델 — 선택 건물을 이어 붙인 미리보기·인쇄 순서"
```

---

### Task 3: 다중 선택 건물 목록 `BuildingPickerList`

**Files:**
- Modify(전체 교체): `app/(staff)/staff/(app)/buildings/components/tenant-output/BuildingPickerList.tsx`

**Interfaces:**
- Consumes: `Building`(`@/hooks/reactquery/buildings`)
- Produces: `export function BuildingPickerList(props: { buildings: Building[]; search: string; onSearch: (value: string) => void; selectedIds: ReadonlySet<number>; onToggle: (id: number) => void; onToggleAll: () => void })` — Task 5가 사용. 목록 컨테이너에 `role="group" aria-label="출력할 건물"`(Task 6 선택자).

- [ ] **Step 1: 파일 전체 교체**

```tsx
"use client";
import type { Building } from "@/hooks/reactquery/buildings";

interface BuildingPickerListProps {
  buildings: Building[];
  search: string;
  onSearch: (value: string) => void;
  selectedIds: ReadonlySet<number>;
  onToggle: (id: number) => void;
  /** 정본 `.pm-all` — 검색과 무관하게 목록 전체를 선택/해제한다. */
  onToggleAll: () => void;
}

/** 정본 `.pm-ck` — 17px 체크박스(선택 시 청록 + 흰 체크). */
function PickerCheck({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative h-[17px] w-[17px] flex-none rounded-[5px] border-[1.6px] ${
        on ? "border-teal bg-teal" : "border-line bg-white"
      }`}
    >
      {on && (
        <span className="absolute left-[5px] top-[1.5px] h-[8px] w-[4px] rotate-45 border-solid border-white [border-width:0_2px_2px_0]" />
      )}
    </span>
  );
}

/** 좌측 건물 선택 패널(정본 `.pm-left`) — 코드·건물명·주소 검색 + 다중 선택. */
export function BuildingPickerList({ buildings, search, onSearch, selectedIds, onToggle, onToggleAll }: BuildingPickerListProps) {
  const keyword = search.trim().toLocaleLowerCase("ko-KR");
  const visible = keyword
    ? buildings.filter((building) =>
        `${building.code} ${building.name} ${building.address ?? ""}`
          .toLocaleLowerCase("ko-KR")
          .includes(keyword),
      )
    : buildings;
  const selectedCount = buildings.filter((building) => selectedIds.has(building.id)).length;
  const allSelected = buildings.length > 0 && selectedCount === buildings.length;

  return (
    <div className="flex w-[340px] shrink-0 flex-col border-r border-line bg-[#fbfcfd] leading-[normal]">
      <div className="relative h-[69px] shrink-0 border-b border-line2">
        {/* 정본 `.pm-search svg` — 입력칸도 absolute라 z-index 없이는 입력칸 흰 배경에 가려진다. */}
        <span aria-hidden className="pointer-events-none absolute left-[28px] top-[26px] z-[1] text-t3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="코드·건물명·주소 검색"
          aria-label="건물 검색"
          className="absolute left-[16px] top-[14px] h-[40px] w-[307px] rounded-[11px] border border-line bg-white pl-[34px] pr-[12px] text-[13.5px] font-semibold text-t1 placeholder:text-[#757575] focus:border-brand focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={onToggleAll}
        aria-pressed={allSelected}
        className="group mb-[4px] flex shrink-0 items-center gap-[9px] border-b border-line2 px-[14px] py-[9px] text-left"
      >
        <PickerCheck on={allSelected} />
        <b className={`text-[13.5px] font-bold ${allSelected ? "text-t1" : "text-t2 group-hover:text-t1"}`}>건물 전체</b>
        <i className="ml-auto text-[12px] font-bold not-italic tabular-nums text-t3">
          {selectedCount > 0 ? `${selectedCount}곳 선택` : ""}
        </i>
      </button>
      <div role="group" aria-label="출력할 건물" className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto p-[8px]">
        {visible.length === 0 ? (
          <p className="px-[14px] py-[28px] text-center text-[13px] font-semibold text-t3">검색 결과가 없어요</p>
        ) : (
          visible.map((building) => {
            const active = selectedIds.has(building.id);
            return (
              <button
                type="button"
                key={building.id}
                onClick={() => onToggle(building.id)}
                aria-pressed={active}
                className={`block w-full rounded-[12px] border px-[14px] py-[12px] text-left transition duration-100 ${
                  active ? "border-teal bg-teal-t" : "border-transparent hover:border-line hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-[8px]">
                  <PickerCheck on={active} />
                  <span
                    className={`flex-none rounded-[6px] border bg-white px-[7px] py-px text-[11px] font-bold tabular-nums text-t3 ${
                      active ? "border-teal-t" : "border-line"
                    }`}
                  >
                    {building.code}
                  </span>
                  <span className={`text-[14px] font-extrabold tracking-[-0.14px] ${active ? "text-teal-d" : "text-t1"}`}>
                    {building.name}
                  </span>
                </span>
                <span className="ml-[26px] mt-[5px] block text-[12px] font-semibold leading-[1.4] text-t3">
                  {building.address ?? "-"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입·린트 확인**

이 시점엔 `TenantOutputModal`이 옛 props(`selectedId`·`onSelect`)를 넘겨 tsc가 그 파일에서 실패한다 — **예상된 실패**이며 Task 5에서 해소된다. 이 파일 자체의 오류만 확인한다:

```bash
node ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep 'error TS' | grep -vE '\.next[/\\]' | grep -v 'TenantOutputModal.tsx'
node ./node_modules/eslint/bin/eslint.js "app/(staff)/staff/(app)/buildings/components/tenant-output/BuildingPickerList.tsx"
```

Expected: 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add "app/(staff)/staff/(app)/buildings/components/tenant-output/BuildingPickerList.tsx"
git commit -m "feat(buildings): 출력 모달 건물 목록 다중 선택 — 체크박스·건물 전체·N곳 선택(정본 .pm-left)"
```

---

### Task 4: 정본 문서 카드 `PreviewPane` + 아이콘

**Files:**
- Create: `components/icons/IdCardIcon.tsx`, `components/icons/DocumentIcon.tsx`
- Modify: `components/icons/index.ts`
- Modify(전체 교체): `app/(staff)/staff/(app)/buildings/components/tenant-output/PreviewPane.tsx`

**Interfaces:**
- Consumes: `OutputQueryStatus`(Task 1), `Button`·`Spinner`(`@/components/common`), `PrinterIcon`
- Produces:
  - `export function IdCardIcon(props: SVGProps<SVGSVGElement>)`, `export function DocumentIcon(props: SVGProps<SVGSVGElement>)` — 획 굵기는 호출부가 `strokeWidth`로 준다
  - `export function PreviewPane(props: { kind: "card" | "statement"; count: number; page: number; buildingLabel: string; onPrev: () => void; onNext: () => void; actionLabel: string; onAction: () => void; actionDisabled?: boolean; status: OutputQueryStatus; emptyMessage?: string; emptyHint?: string; children?: ReactNode })` — `page`는 1부터, `buildingLabel`은 "코드 · 건물명"(없으면 `""`). 루트에 `data-pane={kind}`(Task 6 선택자). 루트 자식 순서 = ① 헤더 ② 건물 줄 ③ 페이지 줄 ④ 종이 영역
  - `PREVIEW_SCALE` export는 제거(다른 사용처 없음 — `grep -rn PREVIEW_SCALE app components hooks lib`로 0건 확인됨)

- [ ] **Step 1: 아이콘 2개 작성**

`components/icons/IdCardIcon.tsx`:

```tsx
import type { SVGProps } from "react";

/** 정본 building-list `ic.card` — 입주자카드(인물 카드) 24 뷰박스, stroke → currentColor. */
export function IdCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <circle cx="12" cy="9" r="2.2" />
      <path d="M8.5 17a3.5 3.5 0 0 1 7 0" />
    </svg>
  );
}
```

`components/icons/DocumentIcon.tsx`:

```tsx
import type { SVGProps } from "react";

/** 정본 building-list `ic.stmt`·`.pm-empty` — 줄 문서 24 뷰박스, stroke → currentColor. */
export function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}
```

`components/icons/index.ts` 끝에 추가:

```ts
export { IdCardIcon } from "./IdCardIcon";
export { DocumentIcon } from "./DocumentIcon";
```

- [ ] **Step 2: PreviewPane 전체 교체**

```tsx
"use client";
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Button, Spinner } from "@/components/common";
import { DocumentIcon, IdCardIcon, PrinterIcon } from "@/components/icons";
import type { OutputQueryStatus } from "@/hooks/reactquery/bill";

/** 정본 `.pm-page` 종이 크기(px). */
const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 594;
/** 1단계: 현재 문서(190mm 폭)를 종이 폭에 맞춰 축소해 넣는다 — 2단계에서 정본 양식으로 교체. */
const DOC_ZOOM = PAGE_WIDTH / ((190 * 96) / 25.4);
const docStyle = { zoom: DOC_ZOOM } as CSSProperties;
const PAGER_BUTTON =
  "flex h-[22px] w-[22px] items-center justify-center rounded-[7px] border border-line bg-white p-0 text-t2 enabled:hover:border-teal enabled:hover:bg-bg enabled:hover:text-teal disabled:opacity-40";
const TITLES = { card: "입주자카드", statement: "관리비부과내역서" } as const;

interface PreviewPaneProps {
  kind: "card" | "statement";
  count: number;
  page: number; // 1-based
  /** 현재 페이지 건물 "코드 · 건물명"(페이지가 없으면 빈 문자열). */
  buildingLabel: string;
  onPrev: () => void;
  onNext: () => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  status: OutputQueryStatus;
  emptyMessage?: string;
  emptyHint?: string;
  children?: ReactNode; // 현재 페이지 문서
}

/** 종이 영역 안 가운데 안내(로딩·실패·빈 상태). */
function PaperMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[4px] bg-bg px-4 text-center">
      {children}
    </div>
  );
}

/** 정본 `.pm-paper` + `.pm-page` — 420×594 종이를 영역에 맞춰 축소해 가운데 둔다(배율 = min((W−28)/420, (H−28)/594)). */
function PaperPage({ children }: { children: ReactNode }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const measure = () => {
      const next = Math.min((area.clientWidth - 28) / PAGE_WIDTH, (area.clientHeight - 28) / PAGE_HEIGHT);
      setScale(next > 0 ? next : 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden bg-bg">
      <div
        className="absolute left-1/2 top-1/2 h-[594px] w-[420px] overflow-hidden rounded-[3px] border border-line bg-white shadow-[0_6px_20px_-4px_rgba(23,31,40,0.18)]"
        style={{
          transform: `translate(-50%, -50%) scale(${scale ?? 1})`,
          visibility: scale === null ? "hidden" : undefined,
        }}
      >
        <div style={docStyle}>{children}</div>
      </div>
    </div>
  );
}

/** 정본 `.pm-doc` 문서 카드: 헤더(아이콘·제목·총 N장) · 건물 줄 · 페이지 줄(페이저·개별 인쇄) · 종이. */
export function PreviewPane({
  kind,
  count,
  page,
  buildingLabel,
  onPrev,
  onNext,
  actionLabel,
  onAction,
  actionDisabled,
  status,
  emptyMessage,
  emptyHint,
  children,
}: PreviewPaneProps) {
  const title = TITLES[kind];
  const hasContent = count > 0;
  const Icon = kind === "card" ? IdCardIcon : DocumentIcon;
  return (
    <div
      data-pane={kind}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] border border-line bg-surface leading-[normal] shadow-[0_2px_8px_rgba(23,31,40,0.06)]"
    >
      <div className="flex shrink-0 items-center gap-[7px] border-b border-line2 bg-[#fbfcfd] px-[15px] py-[11px] text-[12.5px] font-extrabold text-t2">
        <Icon strokeWidth={2} className="h-[15px] w-[15px] shrink-0 text-teal" />
        <h3>{title}</h3>
        <div className="flex-1" />
        <span className="whitespace-nowrap rounded-full bg-bg px-[8px] py-[2px] text-[10.5px] font-bold text-t3">
          총 {count}장
        </span>
      </div>
      {/* 정본 `.pm-doc-b` — 페이지가 없어도 줄 높이는 남긴다. */}
      <div className="shrink-0 bg-white px-[15px] pt-[7px] text-[12px] font-bold text-t3">{buildingLabel || "\u00a0"}</div>
      <div className="flex shrink-0 items-center gap-[8px] border-b border-line2 bg-white px-[15px] py-[8px]">
        {/* 정본 `.pm-pager` — 화살표는 2장 이상일 때만 그린다(1장 이하는 "1 / 1" 글자만). */}
        <div className="inline-flex items-center gap-[3px] text-[11px] font-bold text-t2">
          {count > 1 && (
            <button type="button" aria-label="이전 페이지" onClick={onPrev} disabled={page <= 1} className={PAGER_BUTTON}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-[12px] w-[12px]" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          )}
          <span className="min-w-[34px] text-center tabular-nums">
            {hasContent ? page : 0} / {count}
          </span>
          {count > 1 && (
            <button type="button" aria-label="다음 페이지" onClick={onNext} disabled={page >= count} className={PAGER_BUTTON}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-[12px] w-[12px]" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="inline-flex items-center gap-[5px] enabled:hover:border-teal enabled:hover:bg-teal-t enabled:hover:text-teal disabled:opacity-40"
        >
          <PrinterIcon className="h-[13px] w-[13px]" />
          {actionLabel}
        </Button>
      </div>
      {status === "loading" ? (
        <PaperMessage>
          <Spinner label={`${title} 불러오는 중`} showLabel />
        </PaperMessage>
      ) : status === "error" ? (
        <PaperMessage>
          <p className="text-[12.5px] font-bold text-t2">데이터를 불러오지 못했습니다. 다시 시도해 주세요.</p>
        </PaperMessage>
      ) : hasContent ? (
        <PaperPage>{children}</PaperPage>
      ) : (
        <PaperMessage>
          <p className="text-[12.5px] font-bold text-t2">{emptyMessage ?? "표시할 내용이 없습니다"}</p>
          {emptyHint && <p className="text-[11.5px] text-t3">{emptyHint}</p>}
        </PaperMessage>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 타입·린트 확인**

Task 5 전이라 `TenantOutputModal.tsx`의 옛 props 오류는 예상된 실패다. 그 파일을 뺀 나머지를 확인한다:

```bash
node ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep 'error TS' | grep -vE '\.next[/\\]' | grep -v 'TenantOutputModal.tsx'
node ./node_modules/eslint/bin/eslint.js components/icons/IdCardIcon.tsx components/icons/DocumentIcon.tsx components/icons/index.ts "app/(staff)/staff/(app)/buildings/components/tenant-output/PreviewPane.tsx"
```

Expected: 출력 없음.

- [ ] **Step 4: 커밋**

```bash
git add components/icons/IdCardIcon.tsx components/icons/DocumentIcon.tsx components/icons/index.ts "app/(staff)/staff/(app)/buildings/components/tenant-output/PreviewPane.tsx"
git commit -m "feat(buildings): 출력 모달 문서 카드 정본화 — 헤더·건물 줄·페이지 줄·420×594 종이(정본 .pm-doc)"
```

---

### Task 5: 모달 연결 `TenantOutputModal` + 호출부

**Files:**
- Modify(전체 교체): `app/(staff)/staff/(app)/buildings/components/TenantOutputModal.tsx`
- Modify: `app/(staff)/staff/(app)/buildings/components/BuildingTenantManager.tsx:274-277`

**Interfaces:**
- Consumes: `useTenantOutputData`(Task 1), `buildOutputPages`·`printSequence`·`outputHint`·`PrintScope`(Task 2), `BuildingPickerList`(Task 3), `PreviewPane`·`DocumentIcon`(Task 4), `TenantCardDocument`·`ChargeStatementDocument`(기존, props 불변)
- Produces: `export function TenantOutputModal(props: { onClose: () => void })` — `initialBuildingId` 제거. 인쇄 영역에 `data-print-sheet` 속성(Task 6 선택자).

- [ ] **Step 1: 모달 전체 교체**

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { CloseIcon, DocumentIcon, PrinterIcon } from "@/components/icons";
import { Button, CustomDropdown } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBillOrganizationName, useTenantOutputData } from "@/hooks/reactquery/bill";
import { currentPeriod } from "@/lib/billing/period";
import { PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import { BuildingPickerList } from "./tenant-output/BuildingPickerList";
import { ChargeStatementDocument } from "./tenant-output/ChargeStatementDocument";
import { PreviewPane } from "./tenant-output/PreviewPane";
import { TenantCardDocument } from "./tenant-output/TenantCardDocument";
import { buildOutputPages, outputHint, printSequence, type PrintScope } from "./tenant-output/outputPages";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}월` }));

// 정본 `.pm-dd` 드롭다운. 트리거는 hover 효과 없이 열렸을 때만 청록 테두리, 옵션은 hover 시 --bg·선택 시
// --blue 글자+--blue-t 배경이고 체크표시가 없다. 공용 CustomDropdown 기본값은 여기서만 덮는다.
const PERIOD_DROPDOWN = [
  "[&_.uc-dd-btn]:h-[34px] [&_.uc-dd-btn]:gap-[8px] [&_.uc-dd-btn]:px-[12px] [&_.uc-dd-btn]:tracking-normal",
  "[&_.uc-dd-btn]:shadow-none [&_.uc-dd-btn]:transition-none [&_.uc-dd-btn]:hover:border-line [&_.uc-dd-btn]:hover:shadow-none",
  "[&_.uc-dd.open_.uc-dd-btn]:border-teal",
  "[&_.uc-dd-btn_svg]:h-[13px] [&_.uc-dd-btn_svg]:w-[13px] [&_.uc-dd-btn_svg]:text-t3 [&_.uc-dd-btn_svg]:transition-transform [&_.uc-dd-btn_svg]:duration-150 [&_.uc-dd.open_.uc-dd-btn_svg]:rotate-180",
  "[&_.uc-dd-menu]:top-[calc(100%_+_5px)] [&_.uc-dd-menu]:right-auto [&_.uc-dd-menu]:left-0 [&_.uc-dd-menu]:z-[90] [&_.uc-dd-menu]:max-h-[240px] [&_.uc-dd-menu]:shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)]",
  "[&_.uc-opt]:px-[11px] [&_.uc-opt]:py-[9px] [&_.uc-opt]:transition-none [&_.uc-opt_svg]:hidden [&_.uc-opt.on]:text-teal",
].join(" ");

/** 입주자카드 및 부과내역 출력 모달(정본 building-list `#printModal`) — 건물 다중 선택 → 좌우 미리보기 → 개별/일괄 인쇄. */
export function TenantOutputModal({ onClose }: { onClose: () => void }) {
  const [initYear, initMonth] = useMemo(() => {
    const [rawYear, rawMonth] = currentPeriod().split("-").map(Number);
    return [rawYear, rawMonth] as const;
  }, []);
  // 정본 `#pmYear`: 올해부터 4개 연도 내림차순(2026년 기준 2026·2025·2024·2023).
  const yearOptions = useMemo(
    () => Array.from({ length: 4 }, (_, index) => ({ value: String(initYear - index), label: `${initYear - index}년` })),
    [initYear],
  );
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [search, setSearch] = useState("");
  // 정본 openModal: 선택 없이 연다(스펙 §2-2).
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [cardPage, setCardPage] = useState(0);
  const [statementPage, setStatementPage] = useState(0);
  const [printScope, setPrintScope] = useState<PrintScope | null>(null);

  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: allBuildings = [] } = useBuildings();
  const buildings = useMemo(() => allBuildings.filter((building) => building.orgId === orgId), [allBuildings, orgId]);
  const { data: orgName } = useBillOrganizationName(orgId);
  const companyName = orgName ?? PROGRAM_COMPANY_NAME;

  // 표시·조회·인쇄 순서는 항상 건물 목록 순서다(정본 selBlds) — 클릭 순서가 아니다.
  const selected = useMemo(() => buildings.filter((building) => selectedIds.has(building.id)), [buildings, selectedIds]);
  const selectedIdList = useMemo(() => selected.map((building) => building.id), [selected]);
  const period = `${year}-${String(month).padStart(2, "0")}-01`;
  const outputData = useTenantOutputData(selectedIdList, period);
  const pages = buildOutputPages(selected, outputData);

  const cardCount = pages.cards.length;
  const statementCount = pages.statements.length;
  // 연·월이 바뀌어 쪽수가 줄면 마지막 쪽으로 당긴다(정본 renderDocs clamp).
  const cardIdx = Math.min(cardPage, Math.max(0, cardCount - 1));
  const statementIdx = Math.min(statementPage, Math.max(0, statementCount - 1));
  const card = pages.cards[cardIdx];
  const statement = pages.statements[statementIdx];

  useEffect(() => {
    if (!printScope) return;
    const reset = () => setPrintScope(null);
    window.addEventListener("afterprint", reset, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", reset);
  }, [printScope]);

  // 모달 열림 동안: Esc 닫기 + 배경 스크롤 잠금.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // 정본 syncSel: 선택이 바뀌면 두 미리보기를 1쪽으로 되돌린다.
  const resetPages = () => {
    setCardPage(0);
    setStatementPage(0);
  };
  const toggleBuilding = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    resetPages();
  };
  // 정본 pmAll: 목록 전체가 이미 선택돼 있으면 모두 해제, 아니면 전체 선택(검색으로 좁힌 목록과 무관).
  const toggleAll = () => {
    setSelectedIds((prev) =>
      buildings.length > 0 && buildings.every((building) => prev.has(building.id))
        ? new Set<number>()
        : new Set(buildings.map((building) => building.id)),
    );
    resetPages();
  };

  const hasSelection = selected.length > 0;
  const canPrintCards = pages.cardStatus === "ready" && cardCount > 0;
  const canPrintStatement = pages.statementStatus === "ready" && statementCount > 0;
  // 조회가 끝나지 않았거나 실패가 있으면 일부 건물이 빠진 채 인쇄될 수 있어 막는다.
  const settled = pages.cardStatus === "ready" && pages.statementStatus === "ready";
  const canPrintBoth = hasSelection && settled && (cardCount > 0 || statementCount > 0);
  const printItems = printScope ? printSequence(printScope, pages) : [];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-[28px] print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-output-title"
        onClick={onClose}
      >
        <div
          className="flex h-[min(760px,92vh)] w-[min(1120px,96vw)] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0px_40px_90px_-24px_rgba(0,0,0,0.5)]"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex shrink-0 items-center gap-[10px] border-b border-line px-[22px] py-[18px]">
            <PrinterIcon className="h-5 w-5 text-teal" />
            <h2 id="tenant-output-title" className="text-[17px] font-extrabold tracking-[-0.34px] text-t1">
              입주자카드 및 부과내역 출력
            </h2>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="ml-auto flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-t2 hover:bg-bg"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1">
            <BuildingPickerList
              buildings={buildings}
              search={search}
              onSearch={setSearch}
              selectedIds={selectedIds}
              onToggle={toggleBuilding}
              onToggleAll={toggleAll}
            />

            <div className="flex min-w-0 flex-1 flex-col bg-bg">
              <div className="flex shrink-0 items-center gap-[8px] border-b border-line bg-surface px-[18px] py-[11px]">
                <span className="pr-[2px] text-[12.5px] font-bold text-t3">출력 기준</span>
                <div className={PERIOD_DROPDOWN}>
                  <CustomDropdown
                    ariaLabel="출력 연도"
                    value={String(year)}
                    options={yearOptions}
                    onChange={(value) => setYear(Number(value))}
                  />
                </div>
                <div className={PERIOD_DROPDOWN}>
                  <CustomDropdown
                    ariaLabel="출력 월분"
                    value={String(month)}
                    options={MONTH_OPTIONS}
                    onChange={(value) => setMonth(Number(value))}
                  />
                </div>
              </div>

              {!hasSelection ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-[6px] p-[18px] text-center leading-[normal]">
                  <DocumentIcon strokeWidth={1.8} className="h-[26px] w-[26px] text-teal" />
                  <p className="text-[14px] font-semibold text-t2">왼쪽에서 건물을 선택해 주세요</p>
                  <p className="text-[12.5px] font-medium text-t3">입주자카드와 관리비부과내역서 미리보기가 좌우로 표시돼요</p>
                </div>
              ) : (
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-[16px] p-[18px]">
                  <PreviewPane
                    kind="card"
                    count={cardCount}
                    page={cardIdx + 1}
                    buildingLabel={card ? `${card.building.code} · ${card.building.name}` : ""}
                    onPrev={() => setCardPage(Math.max(0, cardIdx - 1))}
                    onNext={() => setCardPage(Math.min(cardCount - 1, cardIdx + 1))}
                    actionLabel="카드만 인쇄"
                    onAction={() => setPrintScope("card")}
                    actionDisabled={!canPrintCards}
                    status={pages.cardStatus}
                    emptyMessage="등록된 세대가 없습니다"
                  >
                    {card && (
                      <TenantCardDocument
                        building={card.building}
                        tenant={card.tenant}
                        companyName={companyName}
                        year={year}
                        month={month}
                        pageIndex={card.pageIndex}
                        pageCount={card.pageCount}
                      />
                    )}
                  </PreviewPane>

                  <PreviewPane
                    kind="statement"
                    count={statementCount}
                    page={statementIdx + 1}
                    buildingLabel={statement ? `${statement.building.code} · ${statement.building.name}` : ""}
                    onPrev={() => setStatementPage(Math.max(0, statementIdx - 1))}
                    onNext={() => setStatementPage(Math.min(statementCount - 1, statementIdx + 1))}
                    actionLabel="내역서만 인쇄"
                    onAction={() => setPrintScope("statement")}
                    actionDisabled={!canPrintStatement}
                    status={pages.statementStatus}
                    emptyMessage="확정된 부과 내역이 없습니다"
                    emptyHint="관리비 부과 확정(P5) 후 표시됩니다"
                  >
                    {statement && (
                      <ChargeStatementDocument
                        building={statement.building}
                        companyName={companyName}
                        year={year}
                        month={month}
                        feeNames={statement.feeNames}
                        rows={statement.rows}
                        pageIndex={statement.pageIndex}
                        pageCount={statement.pageCount}
                        totals={statement.totals}
                        grandTotal={statement.grandTotal}
                      />
                    )}
                  </PreviewPane>
                </div>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 items-center gap-[10px] border-t border-line px-[22px] py-[14px]">
            <span className="text-[12.5px] font-semibold text-t3">{outputHint(selected, cardCount, statementCount)}</span>
            <div className="flex-1" />
            <Button variant="ghost" type="button" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={() => setPrintScope("both")}
              disabled={!canPrintBoth}
              className="disabled:opacity-45 disabled:shadow-none"
            >
              둘 다 인쇄
            </Button>
          </footer>
        </div>
      </div>

      {printItems.length > 0 && (
        <div data-print-sheet className="hidden print:block">
          <style>{"@media print { @page { size: A4; margin: 0; } }"}</style>
          {printItems.map((item) =>
            item.kind === "card" ? (
              <TenantCardDocument
                key={item.page.key}
                building={item.page.building}
                tenant={item.page.tenant}
                companyName={companyName}
                year={year}
                month={month}
                pageIndex={item.page.pageIndex}
                pageCount={item.page.pageCount}
              />
            ) : (
              <ChargeStatementDocument
                key={item.page.key}
                building={item.page.building}
                companyName={companyName}
                year={year}
                month={month}
                feeNames={item.page.feeNames}
                rows={item.page.rows}
                pageIndex={item.page.pageIndex}
                pageCount={item.page.pageCount}
                totals={item.page.totals}
                grandTotal={item.page.grandTotal}
              />
            ),
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: 호출부에서 `initialBuildingId` 제거**

`BuildingTenantManager.tsx`의

```tsx
        <TenantOutputModal
          initialBuildingId={selected?.id ?? null}
          onClose={() => setOutputOpen(false)}
        />
```

를 다음으로 바꾼다:

```tsx
        <TenantOutputModal onClose={() => setOutputOpen(false)} />
```

- [ ] **Step 3: 타입·린트 확인(이제 전체 통과해야 함)**

```bash
node ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep 'error TS' | grep -vE '\.next[/\\]'
node ./node_modules/eslint/bin/eslint.js "app/(staff)/staff/(app)/buildings/components/TenantOutputModal.tsx" "app/(staff)/staff/(app)/buildings/components/BuildingTenantManager.tsx"
```

Expected: 출력 없음. (`BuildingTenantManager`의 `selected`는 139·141·247·265행에서도 쓰이므로 이 줄을 지워도 unused가 되지 않는다.)

- [ ] **Step 4: 커밋**

```bash
git add "app/(staff)/staff/(app)/buildings/components/TenantOutputModal.tsx" "app/(staff)/staff/(app)/buildings/components/BuildingTenantManager.tsx"
git commit -m "feat(buildings): 출력 모달 다중 선택 연결 — 선택 건물 이어 보기·빈 선택으로 열기·선택 건물 전체 인쇄"
```

---

### Task 6: 통합 검증(헤드리스 정본↔앱) + 병합

**Files:**
- 스크래치: `C:\Users\leebj\AppData\Local\Temp\claude\C--Users-leebj-orca-workspaces-home-erp-pinfish\1a95705e-7b57-4c12-b749-da23a8a48ee1\scratchpad\modal-verify3.mjs`(리포에 넣지 않음)

- [ ] **Step 1: 워크트리 dev 서버 기동**

PowerShell(정션은 Global Constraints대로 연결돼 있어야 함):

```powershell
Copy-Item C:\Users\leebj\orca\projects\home_erp\.env.local C:\Users\leebj\orca\workspaces\home_erp\pinfish\.env.local
```

Git Bash, 백그라운드로:

```bash
cd /c/Users/leebj/orca/workspaces/home_erp/pinfish && node ./node_modules/next/dist/bin/next dev --webpack -p 3127
```

Expected: 로그에 `Ready`. (정션은 Turbopack이 거부하므로 `--webpack` 필수. 포트가 이미 LISTEN이면 그 프로세스를 먼저 정리한다.)

- [ ] **Step 2: 검증 스크립트 작성**

`modal-verify3.mjs`:

```js
// 출력 모달 1단계 검증 — node modal-verify3.mjs canon | app [http://localhost:3127]
import { createRequire } from "node:module";
const require = createRequire("C:/Users/leebj/orca/projects/home_erp/package.json");
const { chromium } = require("playwright");

const mode = process.argv[2];
const APP = process.argv[3] || "http://localhost:3127";
const CANON = "https://staging.d2h12382xiksft.amplifyapp.com/staff/building-list/building-list.dc.html";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1305, height: 888 } });
await ctx.addInitScript(() => { window.print = () => {}; });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(240000);
page.setDefaultTimeout(90000);
const log = (k, v) => console.log(`${k}\t${typeof v === "string" ? v : JSON.stringify(v)}`);
const rect = (sel) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => +v.toFixed(1));
});
const style = (sel, props) => page.locator(sel).first().evaluate((el, props) => {
  const cs = getComputedStyle(el); return Object.fromEntries(props.map((p) => [p, cs[p]]));
}, props);
const printOrder = (sheetSel, itemSel) => page.locator(`${sheetSel} ${itemSel}`).evaluateAll((els) => els.map((el) => {
  const t = el.innerText;
  const stmt = /부과내역서|\[\s*[^\]]+\]/.test(t) && !/입\s*주\s*자\s*카\s*드/.test(t);
  const name = (t.match(/\[\s*([^\]]+?)\s*\]/) || t.match(/빌라명칭\s*[:：]\s*(\S+)/) || [])[1];
  return `${stmt ? "S" : "C"}:${name}`;
}));

if (mode === "canon") {
  await page.goto(CANON, { waitUntil: "networkidle" });
  await page.waitForSelector("#bldBody tr");
  await page.waitForTimeout(800);
  await page.click("#btnPrint");
  await page.waitForTimeout(600);
  log("V1 all-row", await rect("#pmAll"));
  log("V1 item", await rect("#pmList .pm-item"));
  log("V1 check", await rect("#pmList .pm-item .pm-ck"));
  log("V1 addr-dx", (await rect("#pmList .pm-item .pm-addr"))[0] - (await rect("#pmList .pm-item"))[0]);
  await page.click("#pmList .pm-item:nth-child(2)");
  await page.click("#pmList .pm-item:nth-child(3)");
  await page.waitForTimeout(600);
  log("V2 count", await page.locator("#pmAllCnt").innerText());
  log("V2 hint", await page.locator("#pmHint").innerText());
  log("V2 badge", await page.locator("#pmPreview .pm-doc:nth-child(1) .pm-pgbadge").innerText());
  log("V2 bld", await page.locator("#pmPreview .pm-doc:nth-child(1) .pm-doc-b").innerText());
  const D = "#pmPreview .pm-doc:nth-child(1)";
  log("V3 head", { r: await rect(`${D} .pm-doc-h`), s: await style(`${D} .pm-doc-h`, ["fontSize", "fontWeight", "backgroundColor"]) });
  log("V3 bldline", await rect(`${D} .pm-doc-b`));
  log("V3 pagerRow", await rect(`${D} .pm-doc-b + div`));
  log("V3 paper", await rect(`${D} .pm-paper`));
  log("V3 page", await rect(`${D} .pm-page`));
  for (const [label, sel] of [["both", "#pmDo"], ["card", '.pm-print1[data-print="card"]'], ["stmt", '.pm-print1[data-print="stmt"]']]) {
    await page.click(sel);
    await page.waitForTimeout(400);
    log(`V5 ${label}`, await printOrder("#cfPrintSheet", ".cf-page"));
  }
} else {
  for (let i = 0; i < 3; i++) {
    await page.goto(`${APP}/staff/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.fill("#username", "admin");
    await page.fill("#password", "erp!12345");
    await page.click("button[type=submit]");
    try { await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }); break; } catch {}
  }
  await page.goto(`${APP}/staff/buildings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("부과내역 출력")');
  await page.waitForSelector("#tenant-output-title");
  await page.waitForTimeout(800);
  const DLG = "[role=dialog]";
  const ALL = `${DLG} button:has-text("건물 전체")`;
  const ITEMS = `${DLG} [aria-label="출력할 건물"] > button`;
  const item = (name) => `${ITEMS}:has-text("${name}")`;
  const BOTH = `${DLG} button:has-text("둘 다 인쇄")`;
  const HINT = `${DLG} footer > span`;
  const CARD = `${DLG} [data-pane="card"]`;
  const STMT = `${DLG} [data-pane="statement"]`;
  const bldLine = (pane) => `${pane} > div:nth-child(2)`;
  const pagerNum = (pane) => `${pane} > div:nth-child(3) span.tabular-nums`;
  log("V1 all-row", await rect(ALL));
  log("V1 item", await rect(ITEMS));
  log("V1 check", await rect(`${ITEMS} >> span >> nth=1`));
  log("V1 addr-dx", (await rect(`${ITEMS} > span:nth-child(2)`))[0] - (await rect(ITEMS))[0]);
  const names = await page.locator(`${ITEMS} span.font-extrabold`).allInnerTexts();
  log("buildings", names);
  // 입주자카드가 있는 건물 2곳(로컬 데이터: 블루타워 2세대 + 그린빌라). 없으면 앞의 두 곳.
  const known = ["블루타워", "그린빌라"].filter((n) => names.includes(n));
  const pick = known.length === 2 ? known : names.slice(0, 2);
  for (const n of pick) await page.click(item(n));
  await page.waitForTimeout(3000);
  log("V2 count", await page.locator(`${ALL} i`).innerText());
  log("V2 hint", await page.locator(HINT).innerText());
  log("V2 badge", await page.locator(`${CARD} > div:nth-child(1) span`).innerText());
  log("V2 bld", await page.locator(bldLine(CARD)).innerText());
  // 건물 경계: 다음 쪽을 누르며 건물 줄이 바뀌는 쪽을 기록
  const seen = [];
  for (let i = 0; i < 12; i++) {
    seen.push(`${await page.locator(pagerNum(CARD)).innerText()} ${await page.locator(bldLine(CARD)).innerText()}`);
    const next = page.locator(`${CARD} button[aria-label="다음 페이지"]`);
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }
  log("V2 walk", seen);
  log("V3 head", { r: await rect(`${CARD} > div:nth-child(1)`), s: await style(`${CARD} > div:nth-child(1)`, ["fontSize", "fontWeight", "backgroundColor"]) });
  log("V3 bldline", await rect(bldLine(CARD)));
  log("V3 pagerRow", await rect(`${CARD} > div:nth-child(3)`));
  log("V3 paper", await rect(`${CARD} > div:nth-child(4)`));
  log("V3 page", await rect(`${CARD} > div:nth-child(4) > div`));
  for (const [label, sel] of [["both", BOTH], ["card", `${DLG} button:has-text("카드만 인쇄")`], ["stmt", `${DLG} button:has-text("내역서만 인쇄")`]]) {
    if (await page.locator(sel).isDisabled()) { log(`V5 ${label}`, "disabled"); continue; }
    await page.click(sel);
    await page.waitForTimeout(400);
    log(`V5 ${label}`, await printOrder("[data-print-sheet]", "> div"));
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.waitForTimeout(200);
  }
  // RF3: 전부 해제
  for (const n of pick) await page.click(item(n));
  await page.waitForTimeout(300);
  log("RF3", { hint: await page.locator(HINT).innerText(), empty: await page.locator(`${DLG} p:has-text("왼쪽에서 건물을 선택해 주세요")`).count(), both: await page.locator(BOTH).isDisabled() });
  // RF2: 검색으로 좁힌 뒤 건물 전체 → 전체 목록 기준
  await page.fill(`${DLG} input[aria-label="건물 검색"]`, names[0]);
  await page.click(ALL);
  await page.waitForTimeout(300);
  log("RF2", { count: await page.locator(`${ALL} i`).innerText(), total: names.length });
  await page.fill(`${DLG} input[aria-label="건물 검색"]`, "");
  log("RF2 pressed", await page.locator(ITEMS).evaluateAll((els) => els.every((el) => el.getAttribute("aria-pressed") === "true")));
  await page.click(ALL);
  await page.waitForTimeout(300);
  // RF1: 카드 조회가 늦게 오는 동안 로딩·인쇄 막힘, 도착 후 풀림(세대가 있는 pick[0] 사용)
  const CARD_API = "**/api/buildings/*/tenant-cards/print";
  await page.route(CARD_API, async (route) => { await new Promise((r) => setTimeout(r, 4000)); await route.continue(); });
  await page.click(item(pick[0]));
  await page.waitForTimeout(800);
  log("RF1 during", { spinner: await page.locator(`${CARD} [role=status]`).count(), both: await page.locator(BOTH).isDisabled() });
  await page.waitForTimeout(5000);
  log("RF1 after", { both: await page.locator(BOTH).isDisabled() });
  await page.unroute(CARD_API);
  // RF5: pick[0]은 성공한 채로 두고, pick[1] 카드 조회만 실패 → 카드 패널 실패·카드만 인쇄 막힘
  await page.route(CARD_API, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }));
  await page.click(item(pick[1]));
  await page.waitForTimeout(4000);
  log("RF5", { error: await page.locator(`${CARD} p:has-text("불러오지 못했습니다")`).count(), cardPrint: await page.locator(`${DLG} button:has-text("카드만 인쇄")`).isDisabled() });
  await page.unroute(CARD_API);
  // RF4: 두 곳 다시 선택(선택 초기화 후) → 내역서 마지막 쪽에서 월 변경 → 쪽 당김
  for (const n of pick) await page.click(item(n));
  await page.waitForTimeout(300);
  for (const n of pick) await page.click(item(n));
  await page.waitForTimeout(3000);
  for (let i = 0; i < 12; i++) {
    const next = page.locator(`${STMT} button[aria-label="다음 페이지"]`);
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }
  log("RF4 before", await page.locator(pagerNum(STMT)).innerText());
  await page.click(`${DLG} button[aria-label="출력 월분"]`);
  await page.click('[role=listbox][aria-label="출력 월분"] [role=option]:has-text("1월")');
  await page.waitForTimeout(3000);
  log("RF4 after", { pager: await page.locator(pagerNum(STMT)).innerText(), empty: await page.locator(`${STMT} p:has-text("확정된 부과 내역이 없습니다")`).count() });
}
await browser.close();
```

- [ ] **Step 3: 실행·판정**

```bash
cd "/c/Users/leebj/AppData/Local/Temp/claude/C--Users-leebj-orca-workspaces-home-erp-pinfish/1a95705e-7b57-4c12-b749-da23a8a48ee1/scratchpad"
node modal-verify3.mjs canon > v3-canon.txt 2>&1 & node modal-verify3.mjs app > v3-app.txt 2>&1; wait; cat v3-canon.txt; echo ===; cat v3-app.txt
```

판정 기준(정본 = 기준값):
- V1: all-row 높이·item 높이 ±1px, 체크박스 17×17, 주소 x 오프셋(항목 왼쪽 기준) = 정본과 같음(41px = 테두리 1 + 패딩 14 + 26).
- V2: count "2곳 선택", hint "2곳 선택됨 · 카드 X장 · 내역서 Y장"(X·Y는 앱 데이터), badge "총 X장", V2 walk에서 건물 줄이 첫 건물 → 둘째 건물로 한 번 바뀐다.
- V3: 헤더 높이·12.5px/800·배경 `rgb(251, 252, 253)`, 건물 줄·페이지 줄 높이 ±1px, 종이 폭 = 420 × 배율, 배율 = `min((W−28)/420, (H−28)/594)`.
- V5: both = 건물별 `C…` 뒤 `S…`(건물1 → 건물2), card = `C`만, stmt = `S`만(데이터 없는 버튼은 disabled로 기록).
- RF1 during: 로딩 표시 ≥1·both disabled=true, after: both disabled=false(내역서가 없어도 카드가 있으면 false). RF2: count = "{전체}곳 선택", pressed=true. RF3: hint "건물을 선택해 주세요", empty 1, both true. RF4 after: pager가 존재하는 쪽(`0 / 0`이면 empty 1). RF5: error 1, cardPrint true.

실패 항목이 있으면 해당 태스크 파일을 고치고 Step 3을 다시 돈다(고친 파일은 그 태스크 커밋 메시지 규칙으로 추가 커밋).

- [ ] **Step 4: 정리**

dev 서버 중지 → PowerShell:

```powershell
$wt = "C:\Users\leebj\orca\workspaces\home_erp\pinfish"
Remove-Item "$wt\.env.local" -Force
cmd /c rd /s /q "$wt\.next"
cmd /c rmdir "$wt\node_modules"
(Get-ChildItem C:\Users\leebj\orca\projects\home_erp\node_modules -Force | Measure-Object).Count
```

Expected: 마지막 수가 작업 전과 같다(정션만 제거, master node_modules 보존).

- [ ] **Step 5: master 병합·push·WBS**

```bash
cd /c/Users/leebj/orca/workspaces/home_erp/pinfish && git fetch -q origin
git merge-tree --write-tree origin/master PracLee/pinfish >/dev/null && echo "no conflicts"
git -C /c/Users/leebj/orca/projects/home_erp status --short -- "app/(staff)/staff/(app)/buildings" hooks/reactquery/bill components/icons
git -C /c/Users/leebj/orca/projects/home_erp merge --no-ff PracLee/pinfish -m "Merge PracLee/pinfish: 출력 모달 다중 선택·미리보기 정본 정합(1단계)"
git -C /c/Users/leebj/orca/projects/home_erp push origin master
```

Expected: "no conflicts", 두 번째 명령 출력 없음(해당 경로에 다른 세션 미커밋 변경 없음), 병합·push 성공. 충돌·거부 시 멈추고 사용자에게 알린다. 병합 뒤 `wbs-commit-sync`로 이 브랜치의 새 커밋을 "사무실 관리자_건물·입주자 관리"(f58675ab)에 반영한다(dev=완료 유지, 비고는 마커 다음 통계 줄 교체 + 날짜 항목 추가, 쓰기 전후 재조회 대조).
