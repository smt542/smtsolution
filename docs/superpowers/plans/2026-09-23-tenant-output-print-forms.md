# 입주자카드·부과내역서 인쇄 양식 교체(출력 모달 2단계) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출력 모달의 종이 안 문서·인쇄물을 정본 `cardForm`·`stmtForm` 양식으로 바꾸고 실제 데이터로 채운다.

**Architecture:** 원문 연락처가 필요한 세대 행만 기존 인쇄 라우트에 필드를 덧붙여 받고(호환), 건물·업체·고객번호·회사·부과 항목·검침은 기존 클라이언트 조회를 `useQueries`로 모은다(`hooks/reactquery/tenantOutput/`). 순수 함수(`cardSheet.ts`·`statementSheet.ts`)가 쪽 단위 데이터를 만들고, 양식 컴포넌트 두 개가 정본 마크업을 화면 값 + `print:` 인쇄 값으로 그린다. 인쇄 시트는 body 직속 포털 + 인쇄 격리 CSS.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · @tanstack/react-query v5 · Supabase(route handler)

**Spec:** `docs/superpowers/specs/2026-09-23-tenant-output-print-forms-design.md`

## Global Constraints

- 워크트리 `C:\Users\leebj\orca\workspaces\home_erp\pinfish`(브랜치 `PracLee/pinfish`)는 **다른 세션(pinfish-4b)과 공유**한다. 그 세션 파일 — `app/(staff)/staff/(app)/buildings/[id]/**`, `components/forms/schema/occupancy.ts`, `hooks/reactquery/occupancies/apis.ts`, `supabase/**` — 은 읽기만 하고 수정·스테이징 금지. 커밋은 이 계획의 파일만 `git add`.
- 단위 테스트 금지(회사 정책). 검증 = tsc + ESLint(변경 파일) + Task 6 헤드리스 점검.
- 정션 규칙: `node_modules` 정션이 이미 있으면 만들지도 지우지도 않는다(만든 쪽이 지움). 명령: tsc `node ./node_modules/typescript/bin/tsc --noEmit`(`.next` 경로 오류 제외), ESLint `node ./node_modules/eslint/bin/eslint.js <파일>`. tsc 오류가 다른 세션 파일에서만 나면 이 작업 실패가 아니다(보고만).
- 공용 컴포넌트(`components/common/**`) 수정 금지. 마이그레이션 없음.
- 문구·값은 스펙 §4·§9 그대로. 결정 D1~D12는 스펙 §2.2.

## Review Focus

- **RF1 협력업체·고객번호가 비어 있는 건물**: 블록 라벨은 남고 값만 비어야 하며, 고객번호 표는 머리행 + 빈 행 1줄(D8).
- **RF2 공실 세대**: 이름·연락처·입주일자·관리비 빈칸, 현관키 `N 공실`, 분류·평형은 표시.
- **RF3 부과 항목이 6개 미만·18개 초과**: 열 수 = max(6, ⌈n/3⌉), 빈 슬롯은 머리·Y 모두 빈칸.
- **RF4 확정되지 않은 건물이 섞인 선택**: 그 건물은 내역서 0쪽, 카드는 정상, 인쇄 순서에서 내역서만 빠짐.
- **RF5 인쇄에 화면 내용 섞임**: 인쇄 PDF 쪽수가 기대값과 정확히 같아야 한다(D11).

---

## 파일 구조

| 파일 | 작업 | 책임 |
|---|---|---|
| `app/api/buildings/[id]/tenant-cards/print/route.ts` | 수정 | 세대 행에 `areaPyeong`·`mgmtFeeAmount`·`increaseAmount`·`phone3` 추가 |
| `hooks/reactquery/tenantOutput/apis.ts`·`keys.ts`·`index.ts` | 생성 | 인쇄 세대 행 타입·조회, 키 |
| `hooks/reactquery/tenantOutput/useTenantOutputData.ts` | 생성(이동) | 1단계 훅을 옮기고 건물 상세·부과 항목·검침 조회 추가 |
| `hooks/reactquery/bill/useTenantOutputData.ts` | 삭제 | (이동) |
| `hooks/reactquery/bill/index.ts` | 수정 | 옛 export 제거 |
| `app/(staff)/staff/(app)/buildings/new-v2/_components/config/formState.ts` | 수정 | `mergeVendors` export(동작 불변) |
| `app/(staff)/staff/(app)/buildings/components/tenant-output/cardSheet.ts` | 생성 | 입주자카드 쪽 데이터 |
| `…/tenant-output/statementSheet.ts` | 생성 | 부과내역서 쪽 데이터 |
| `…/tenant-output/TenantCardSheet.tsx` | 생성 | 입주자카드 양식 |
| `…/tenant-output/ChargeStatementSheet.tsx` | 생성 | 부과내역서 양식 |
| `…/tenant-output/outputPages.ts` | 수정(전체 교체) | 새 쪽 데이터로 펼치기 |
| `…/tenant-output/PreviewPane.tsx` | 수정 | 종이 안쪽 여백 40/34, 문서 축소 제거 |
| `…/components/TenantOutputModal.tsx` | 수정(전체 교체) | 조직 정보·새 양식·인쇄 포털 |
| `…/tenant-output/TenantCardDocument.tsx`·`ChargeStatementDocument.tsx`·`statement.ts` | 삭제 | 옛 문서(다른 사용처 없음) |

(`…` = `app/(staff)/staff/(app)/buildings/components`)

---

### Task 1: 인쇄 라우트 세대 행 필드 추가

**Files:** Modify `app/api/buildings/[id]/tenant-cards/print/route.ts`

**Interfaces:** Produces 응답 원소 추가 필드 `areaPyeong: number | null`, `mgmtFeeAmount: number | null`, `increaseAmount: number | null`, `phone3: string | null`(기존 필드·권한·PRINT 기록 불변).

- [ ] **Step 1: 타입 두 개 교체**

```ts
type TenantCardRpcRow = {
  unit_id: number;
  occupancy_id: number | null;
  unit_no: string;
  tenant_name: string | null;
  room_type_label: string | null;
  resident_count: number | null;
  move_in_date: string | null;
  is_vacant: boolean;
  is_overdue: boolean;
  area_pyeong: number | string | null;
  mgmt_fee_amount: number | string | null;
  increase_amount: number | string | null;
};

type OccupancyPhoneRow = {
  id: number;
  phone: string | null;
  phone3: string | null;
};
```

- [ ] **Step 2: 원문 재조회에 phone3 포함**

`const phoneByOccupancyId = new Map<number, string | null>();` 를 다음으로 바꾼다:

```ts
  const phoneByOccupancyId = new Map<number, { phone: string | null; phone3: string | null }>();
```

`.select("id, phone")` → `.select("id, phone, phone3")`, 채우는 줄 → `phoneByOccupancyId.set(row.id, { phone: row.phone, phone3: row.phone3 });`

- [ ] **Step 3: 응답 원소 교체**

```ts
  // PostgREST는 numeric을 문자열("8.50")로 줄 수 있어 숫자로 맞춘다.
  const toNumber = (value: number | string | null) => (value == null ? null : Number(value));
  const tenantCards = rows.map((row) => {
    const phones = row.occupancy_id === null ? undefined : phoneByOccupancyId.get(row.occupancy_id);
    return {
      unitId: row.unit_id,
      unitNo: row.unit_no,
      tenantName: row.tenant_name,
      roomTypeLabel: row.room_type_label,
      residentCount: row.resident_count,
      moveInDate: row.move_in_date,
      phone: phones?.phone ?? null,
      phone3: phones?.phone3 ?? null,
      areaPyeong: toNumber(row.area_pyeong),
      mgmtFeeAmount: toNumber(row.mgmt_fee_amount),
      increaseAmount: toNumber(row.increase_amount),
      isVacant: row.is_vacant,
      isOverdue: row.is_overdue,
    };
  });
```

- [ ] **Step 4: 검증** — `tsc`(이 파일 오류 0), `eslint app/api/buildings/[id]/tenant-cards/print/route.ts`.

- [ ] **Step 5: 커밋** — `git add "app/api/buildings/[id]/tenant-cards/print/route.ts"` · `feat(api): 입주자카드 인쇄 라우트에 평형·관리비·인상액·연락처3 추가(호환)`

---

### Task 2: `tenantOutput` 조회 모듈

**Files:** Create `hooks/reactquery/tenantOutput/{apis.ts,keys.ts,useTenantOutputData.ts,index.ts}` · Delete `hooks/reactquery/bill/useTenantOutputData.ts` · Modify `hooks/reactquery/bill/index.ts`(마지막 줄 `export * from "./useTenantOutputData";` 삭제)

**Interfaces:**
- Produces: `TenantCardSheetRow`, `getTenantCardSheetRows(buildingId)`, `tenantOutputKeys.cardRows(buildingId)`, `OutputQueryStatus`, `TenantOutputBuildingData { buildingId; cardRows; buildingFull; cardStatus; documents; feeItems; elecRows; waterRows; statementStatus }`, `useTenantOutputData(buildings: Building[], period: string): TenantOutputBuildingData[]`

- [ ] **Step 1: `apis.ts`**

```ts
/** 입주자카드 인쇄 라우트의 세대 행(원문 연락처 포함) — 출력 모달 전용 타입. */
export interface TenantCardSheetRow {
  unitId: number;
  unitNo: string;
  tenantName: string | null;
  roomTypeLabel: string | null;
  residentCount: number | null;
  moveInDate: string | null;
  phone: string | null;
  phone3: string | null;
  areaPyeong: number | null;
  mgmtFeeAmount: number | null;
  increaseAmount: number | null;
  isVacant: boolean;
}

export async function getTenantCardSheetRows(buildingId: number): Promise<TenantCardSheetRow[]> {
  const response = await fetch(`/api/buildings/${buildingId}/tenant-cards/print`, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "입주자 카드 데이터를 불러오지 못했습니다.");
  }
  return ((data ?? []) as TenantCardSheetRow[]).map((row) => ({
    ...row,
    phone3: row.phone3 ?? null,
    areaPyeong: row.areaPyeong ?? null,
    mgmtFeeAmount: row.mgmtFeeAmount ?? null,
    increaseAmount: row.increaseAmount ?? null,
  }));
}
```

- [ ] **Step 2: `keys.ts`**

```ts
export const tenantOutputKeys = {
  cardRows: (buildingId: number) => ["tenantOutput", "card-rows", buildingId] as const,
};
```

- [ ] **Step 3: `useTenantOutputData.ts`**

```ts
import { useQueries } from "@tanstack/react-query";
import { billKeys, getBillDocuments, listBillTargets, type BillDocument } from "@/hooks/reactquery/bill";
import { buildingKeys, getBuildingFull, type Building, type BuildingFull } from "@/hooks/reactquery/buildings";
import { feeItemKeys, listFeeItems, type FeeItem } from "@/hooks/reactquery/feeItems";
import { listUtilityRows, utilityKeys, type UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { getTenantCardSheetRows, type TenantCardSheetRow } from "./apis";
import { tenantOutputKeys } from "./keys";

/** 출력 모달 패널 하나의 조회 상태. */
export type OutputQueryStatus = "loading" | "error" | "ready";

export interface TenantOutputBuildingData {
  buildingId: number;
  cardRows: TenantCardSheetRow[];
  buildingFull: BuildingFull | null;
  cardStatus: OutputQueryStatus;
  documents: BillDocument[];
  feeItems: FeeItem[];
  elecRows: UtilityUnitRow[];
  waterRows: UtilityUnitRow[];
  statementStatus: OutputQueryStatus;
}

type QueryState = { isError: boolean; isPending: boolean } | undefined;
const statusOf = (queries: QueryState[]): OutputQueryStatus =>
  queries.some((query) => query?.isError) ? "error" : queries.some((query) => query?.isPending) ? "loading" : "ready";

/**
 * 입주자카드·부과내역 출력 모달 — 선택 건물마다 양식에 필요한 데이터를 병렬 조회한다.
 * 단일 화면 훅과 같은 query key·API를 써서 캐시를 공유한다(선례: useAdjustmentStatements).
 * 부과내역서용 조회(문서·부과 항목·검침)는 확정 세대가 있는 건물만 켠다. 반환 순서 = buildings 순서.
 */
export function useTenantOutputData(buildings: Building[], period: string): TenantOutputBuildingData[] {
  const cardQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: tenantOutputKeys.cardRows(building.id),
      queryFn: () => getTenantCardSheetRows(building.id),
      // 원문 연락처가 담긴 응답이라 화면을 벗어나면 캐시에 남기지 않는다.
      gcTime: 0,
    })),
  });
  const fullQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: buildingKeys.full(building.id),
      queryFn: () => getBuildingFull(building.id),
    })),
  });
  const targetQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: billKeys.targets(building.id, period),
      queryFn: () => listBillTargets(building.id, period),
    })),
  });
  const hasUnits = (index: number) => (targetQueries[index]?.data?.length ?? 0) > 0;
  const documentQueries = useQueries({
    queries: buildings.map((building, index) => {
      const unitIds = (targetQueries[index]?.data ?? []).map((target) => target.unitId);
      return {
        queryKey: billKeys.documents(building.id, period, unitIds),
        queryFn: () => getBillDocuments(building.id, period, unitIds),
        enabled: unitIds.length > 0,
      };
    }),
  });
  const feeItemQueries = useQueries({
    queries: buildings.map((building, index) => ({
      queryKey: feeItemKeys.list(building.typeId ?? 0),
      queryFn: () => listFeeItems(building.typeId as number),
      enabled: building.typeId != null && hasUnits(index),
    })),
  });
  const elecQueries = useQueries({
    queries: buildings.map((building, index) => ({
      queryKey: utilityKeys.rows(building.id, "electricity", period),
      queryFn: () => listUtilityRows(building.id, "electricity", period),
      enabled: hasUnits(index),
    })),
  });
  const waterQueries = useQueries({
    queries: buildings.map((building, index) => ({
      queryKey: utilityKeys.rows(building.id, "water", period),
      queryFn: () => listUtilityRows(building.id, "water", period),
      enabled: hasUnits(index),
    })),
  });

  // 콜백 반환 타입을 명시해야 상태 리터럴이 string으로 넓혀지지 않는다.
  return buildings.map((building, index): TenantOutputBuildingData => {
    const units = hasUnits(index);
    const typed = building.typeId != null;
    return {
      buildingId: building.id,
      cardRows: cardQueries[index]?.data ?? [],
      buildingFull: fullQueries[index]?.data ?? null,
      cardStatus: statusOf([cardQueries[index], fullQueries[index]]),
      documents: units ? (documentQueries[index]?.data ?? []) : [],
      feeItems: units && typed ? (feeItemQueries[index]?.data ?? []) : [],
      elecRows: units ? (elecQueries[index]?.data ?? []) : [],
      waterRows: units ? (waterQueries[index]?.data ?? []) : [],
      // 꺼진 쿼리(pending·idle)는 로딩으로 치지 않는다.
      statementStatus: statusOf([
        targetQueries[index],
        units ? documentQueries[index] : undefined,
        units && typed ? feeItemQueries[index] : undefined,
        units ? elecQueries[index] : undefined,
        units ? waterQueries[index] : undefined,
      ]),
    };
  });
}
```

- [ ] **Step 4: `index.ts`**

```ts
export * from "./apis";
export * from "./keys";
export * from "./useTenantOutputData";
```

- [ ] **Step 5: 옛 파일 삭제·배럴 정리** — `hooks/reactquery/bill/useTenantOutputData.ts` 삭제, `hooks/reactquery/bill/index.ts`에서 그 export 줄 삭제. (이 시점엔 `TenantOutputModal`·`outputPages.ts`가 옛 경로를 import 해 tsc가 그 두 파일에서 실패 — Task 5에서 해소, 예상된 실패.)

- [ ] **Step 6: 검증** — `tsc`에서 `TenantOutputModal.tsx`·`outputPages.ts` 외 오류 0, `eslint hooks/reactquery/tenantOutput/*.ts hooks/reactquery/bill/index.ts`.

- [ ] **Step 7: 커밋** — `git add hooks/reactquery/tenantOutput hooks/reactquery/bill/index.ts hooks/reactquery/bill/useTenantOutputData.ts` · `feat(tenant-output): 출력 모달 조회 모듈 — 인쇄 세대 행·건물 상세·부과 항목·검침 병렬 조회`

---

### Task 3: 양식 데이터 빌더

**Files:** Modify `app/(staff)/staff/(app)/buildings/new-v2/_components/config/formState.ts`(`function mergeVendors(` → `export function mergeVendors(`) · Create `…/tenant-output/cardSheet.ts`, `…/tenant-output/statementSheet.ts`

**Interfaces:**
- Consumes: `mergeVendors(saved, normalized)`(반환 `Record<string, { fields: Record<string, string>; memo: string }>` 형태), `TenantCardSheetRow`, `BuildingFull`, `BillDocument`, `FeeItem`, `UtilityUnitRow`, `formatNumber`·`formatDate`·`formatPhone`(`@/lib/format`)
- Produces: `CARD_UNITS_PER_PAGE=12`, `CardSheetPage`, `CardOrgInfo`, `compareUnitNo`, `buildCardSheetPages(building, full, rows, org)`, `STATEMENT_UNITS_PER_PAGE=14`, `StatementSheetPage`, `buildStatementSheetPages(building, documents, feeItems, elecRows, waterRows)`

- [ ] **Step 1: `cardSheet.ts`**

```ts
import type { Building, BuildingFull } from "@/hooks/reactquery/buildings";
import type { TenantCardSheetRow } from "@/hooks/reactquery/tenantOutput";
import { formatDate, formatNumber, formatPhone } from "@/lib/format";
import { mergeVendors } from "../../new-v2/_components/config/formState";

/** 입주자카드 한 쪽의 세대 수(정본 CARD_ROWS). */
export const CARD_UNITS_PER_PAGE = 12;

export interface CardSheetHeader {
  code: string;
  dongName: string;
  address: string;
  name: string;
  phone: string;
  company: string;
  keyLine: string;
  memo: string;
}
export interface CardVendorBlocks {
  cleaning: { manager: string; frequency: string; weekdays: string; amount: string; remarks: string };
  septic: { vendor: string; phone: string; amount: string; billingType: string };
  internet: { vendor: string; holder: string; amount: string };
}
export interface CardNumberLine {
  lin: number;
  customerNo: string;
  holderName: string;
  basis: string;
  calculation: string;
  meterDay: string;
  print: string;
  note: string;
}
export interface CardUnitLine {
  key: string;
  unitNo: string;
  name: string;
  roomType: string;
  residents: string;
  area: string;
  homePhone: string;
  mobilePhone: string;
  moveIn: string;
  mgmtFee: string;
  afterIncrease: string;
  increase: string;
  entranceKey: string;
}
export interface CardSheetPage {
  key: string;
  building: Building;
  header: CardSheetHeader;
  blocks: CardVendorBlocks;
  water: CardNumberLine[];
  commonElec: CardNumberLine[];
  units: CardUnitLine[];
  /** 건물 안에서의 쪽 번호(0부터). */
  pageIndex: number;
  pageCount: number;
}
/** 조직 단위 값(회사명·대표전화·청소 담당자 이름 조회). */
export interface CardOrgInfo {
  companyName: string;
  companyPhone: string;
  cleaningManagerName: (userId: string | null) => string;
}

type CustomerNumberRow = BuildingFull["customerNumbers"][number];

const text = (value: string | null | undefined) => (value ?? "").trim();
/** 정본·PDF 표기: 호수 끝의 "호"를 뗀다(D12). */
export const unitLabel = (unitNo: string) => unitNo.replace(/호$/, "");
/** 호수 숫자순(101 < 201 < 1001). */
export const compareUnitNo = (a: string, b: string) => a.localeCompare(b, "ko-KR", { numeric: true });
const phoneText = (value: string | null) => (text(value) ? formatPhone(text(value)) : "");

function numberLines(rows: CustomerNumberRow[], kind: "water" | "common_elec"): CardNumberLine[] {
  return rows
    .filter((row) => row.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, index) => ({
      lin: index + 1,
      customerNo: row.customerNo,
      holderName: text(row.holderName),
      basis: row.billingBasis === "prev" ? "전월" : "당월",
      calculation: row.calculationMethod === "manual" ? "수동" : "자동",
      meterDay: row.meterDay == null ? "" : String(row.meterDay),
      print: row.printOnBill ? "Y" : "N",
      note: text(row.note),
    }));
}

function unitLine(row: TenantCardSheetRow): CardUnitLine {
  const vacant = row.isVacant;
  const fee = vacant ? null : row.mgmtFeeAmount;
  const increase = vacant ? 0 : (row.increaseAmount ?? 0);
  return {
    key: String(row.unitId),
    unitNo: unitLabel(row.unitNo),
    name: vacant ? "" : text(row.tenantName),
    roomType: text(row.roomTypeLabel),
    residents: vacant || row.residentCount == null ? "" : String(row.residentCount),
    area: formatNumber(row.areaPyeong, { nullText: "", fractionDigits: 2 }),
    homePhone: vacant ? "" : phoneText(row.phone3),
    mobilePhone: vacant ? "" : phoneText(row.phone),
    moveIn: vacant ? "" : formatDate(row.moveInDate, { nullText: "" }),
    mgmtFee: formatNumber(fee, { nullText: "" }),
    // D7: 인상 계획이 있을 때만 인상후·인상폭을 찍는다.
    afterIncrease: fee != null && increase > 0 ? formatNumber(fee + increase, { nullText: "" }) : "",
    increase: increase > 0 ? formatNumber(increase, { nullText: "" }) : "",
    entranceKey: vacant ? "N 공실" : "Y",
  };
}

/** 건물 1곳의 입주자카드 쪽들(공실 포함 전 세대, 쪽당 12세대, 최소 1쪽 — D2). */
export function buildCardSheetPages(
  building: Building,
  full: BuildingFull | null,
  rows: TenantCardSheetRow[],
  org: CardOrgInfo,
): CardSheetPage[] {
  const source = full ?? building;
  const address = text(source.address);
  const entrance = text(source.entrancePassword);
  // 건물 편집 화면과 같은 규칙으로 정규화 업체 행과 vendor_details 키를 합친다(D1).
  const vendors = mergeVendors(full?.vendorDetails?.vendors, full?.vendors ?? []);
  const cleaning = vendors.cleaning;
  const septic = vendors.septic;
  const internet = vendors.internet;
  const header: CardSheetHeader = {
    code: source.code,
    dongName: address.split(" ")[1] || "—",
    address,
    name: source.name,
    phone: org.companyPhone,
    company: org.companyName,
    keyLine: entrance ? `입구${entrance}` : "",
    memo: text(source.memo),
  };
  const blocks: CardVendorBlocks = {
    cleaning: {
      manager: org.cleaningManagerName(source.cleaningUserId),
      frequency: text(cleaning?.fields["청소 횟수"]),
      weekdays: text(cleaning?.fields["청소 요일"]),
      amount: text(cleaning?.fields["청소 금액"]),
      remarks: text(cleaning?.memo),
    },
    septic: {
      vendor: text(septic?.fields["업체명"]),
      phone: text(septic?.fields["전화번호"]),
      amount: text(septic?.fields["금액"]),
      billingType: text(septic?.fields["정화조 구분"]),
    },
    internet: {
      vendor: text(internet?.fields["업체명"]),
      holder: "",
      amount: text(internet?.fields["인터넷 금액"]),
    },
  };
  const customerNumbers = full?.customerNumbers ?? [];
  const water = numberLines(customerNumbers, "water");
  const commonElec = numberLines(customerNumbers, "common_elec");
  const units = [...rows].sort((a, b) => compareUnitNo(a.unitNo, b.unitNo)).map(unitLine);
  const chunks: CardUnitLine[][] = [];
  for (let index = 0; index < units.length; index += CARD_UNITS_PER_PAGE) {
    chunks.push(units.slice(index, index + CARD_UNITS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);
  return chunks.map((chunk, index) => ({
    key: `card-${building.id}-${index}`,
    building,
    header,
    blocks,
    water,
    commonElec,
    units: chunk,
    pageIndex: index,
    pageCount: chunks.length,
  }));
}
```

- [ ] **Step 2: `statementSheet.ts`**

```ts
import type { BillDocument } from "@/hooks/reactquery/bill";
import type { Building } from "@/hooks/reactquery/buildings";
import type { FeeItem } from "@/hooks/reactquery/feeItems";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { compareUnitNo, unitLabel } from "./cardSheet";

/** 부과내역서 한 쪽의 세대 수(정본 STMT_ROWS). */
export const STATEMENT_UNITS_PER_PAGE = 14;
/** 정본 SG는 6열 고정 — 항목이 적어도 6열 폭을 유지한다(D4). */
export const STATEMENT_MIN_GROUPS = 6;

export interface StatementCell {
  amount: string;
  flag: "Y" | "N" | "";
}
export interface StatementUnitLine {
  key: string;
  unitNo: string;
  /** rows[행 0~2][열 g] */
  rows: StatementCell[][];
  /** [전기, 수도] */
  previous: [string, string];
  current: [string, string];
}
export interface StatementSheetPage {
  key: string;
  building: Building;
  /** 열마다 항목 이름 3개(빈 슬롯은 ""). */
  groups: string[][];
  units: StatementUnitLine[];
  pageIndex: number;
  pageCount: number;
}

const reading = (value: number | null | undefined) => (value == null ? "" : String(value));

/** 세대별 첫 번째 검침 행(D6). */
function firstRowByUnit(rows: UtilityUnitRow[]): Map<number, UtilityUnitRow> {
  const map = new Map<number, UtilityUnitRow>();
  for (const row of rows) if (!map.has(row.unitId)) map.set(row.unitId, row);
  return map;
}

/** 건물 1곳의 부과내역서 쪽들(확정 세대만, 쪽당 14세대, 확정이 없으면 0쪽 — D3). */
export function buildStatementSheetPages(
  building: Building,
  documents: BillDocument[],
  feeItems: FeeItem[],
  elecRows: UtilityUnitRow[],
  waterRows: UtilityUnitRow[],
): StatementSheetPage[] {
  if (documents.length === 0) return [];
  // 건물 유형 항목(설정 순서). 설정에서 지워졌지만 스냅샷에 남은 항목은 뒤에 붙인다.
  const ordered = [...feeItems]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((item) => ({ id: item.id, name: item.name }));
  const known = new Set(ordered.map((item) => item.id));
  for (const doc of documents) {
    for (const item of doc.items) {
      if (known.has(item.feeItemId)) continue;
      known.add(item.feeItemId);
      ordered.push({ id: item.feeItemId, name: item.name });
    }
  }
  const groupCount = Math.max(STATEMENT_MIN_GROUPS, Math.ceil(ordered.length / 3));
  const slots = Array.from({ length: groupCount * 3 }, (_, index) => ordered[index] ?? null);
  const groups = Array.from({ length: groupCount }, (_, group) =>
    [0, 1, 2].map((row) => slots[group * 3 + row]?.name ?? ""),
  );
  const elec = firstRowByUnit(elecRows);
  const water = firstRowByUnit(waterRows);
  const units = [...documents]
    .sort((a, b) => compareUnitNo(a.unitNo, b.unitNo))
    .map((doc): StatementUnitLine => {
      const byItem = new Map(doc.items.map((item) => [item.feeItemId, item]));
      const rows = [0, 1, 2].map((row) =>
        Array.from({ length: groupCount }, (_, group): StatementCell => {
          const slot = slots[group * 3 + row];
          if (!slot) return { amount: "", flag: "" };
          const item = byItem.get(slot.id);
          // D5: 확정 스냅샷에 있으면 부과(Y), 건물 항목인데 없으면 미부과(N).
          if (!item || !item.charged) return { amount: "", flag: "N" };
          return { amount: item.amount ? formatNumber(item.amount, { nullText: "" }) : "", flag: "Y" };
        }),
      );
      const e = elec.get(doc.unitId);
      const w = water.get(doc.unitId);
      return {
        key: String(doc.unitId),
        unitNo: unitLabel(doc.unitNo),
        rows,
        previous: [reading(e?.previousReading), reading(w?.previousReading)],
        current: [reading(e?.currentReading), reading(w?.currentReading)],
      };
    });
  const chunks: StatementUnitLine[][] = [];
  for (let index = 0; index < units.length; index += STATEMENT_UNITS_PER_PAGE) {
    chunks.push(units.slice(index, index + STATEMENT_UNITS_PER_PAGE));
  }
  return chunks.map((chunk, index) => ({
    key: `statement-${building.id}-${index}`,
    building,
    groups,
    units: chunk,
    pageIndex: index,
    pageCount: chunks.length,
  }));
}
```

- [ ] **Step 3: 검증** — `tsc`: 이 두 파일·`formState.ts` 오류 0(모달·outputPages 오류는 Task 5 전 예상). `eslint` 세 파일.

- [ ] **Step 4: 커밋** — `git add "…/tenant-output/cardSheet.ts" "…/tenant-output/statementSheet.ts" "app/(staff)/staff/(app)/buildings/new-v2/_components/config/formState.ts"` · `feat(buildings): 출력 모달 양식 데이터 — 입주자카드(12세대/쪽)·부과내역서(14세대/쪽·Y/N·검침)`

---

### Task 4: 양식 컴포넌트

**Files:** Create `…/tenant-output/TenantCardSheet.tsx`, `…/tenant-output/ChargeStatementSheet.tsx`

**Interfaces:** Produces `TenantCardSheet({ page, year, month }: { page: CardSheetPage; year: number; month: number })`, `ChargeStatementSheet({ page, year, month }: { page: StatementSheetPage; year: number; month: number })`. 화면 값이 기본 클래스, 인쇄 값은 `print:`(스펙 §9.2·§9.3).

- [ ] **Step 1: `TenantCardSheet.tsx`**

```tsx
import type { CardNumberLine, CardSheetPage } from "./cardSheet";

// 정본 building-list `.cf`(화면) + `doPrint` @media print. 화면 값이 기본, 인쇄 값은 print: 로 덮는다.
const HEAD_CELL =
  "overflow-hidden text-ellipsis whitespace-nowrap px-[6px] py-[3px] text-[8.4px] print:px-[2mm] print:py-[1.4mm] print:text-[9pt]";
const BOX =
  "flex gap-[8px] border border-t-0 border-[#444] px-[6px] py-[4px] print:gap-[3mm] print:border-[0.8pt] print:border-t-0 print:border-black print:px-[2mm] print:py-[1.4mm]";
const LABEL =
  "h-fit flex-none rounded-[2px] border border-[#444] px-[5px] py-[1px] font-bold print:border-[0.7pt] print:border-black print:px-[1.6mm] print:py-[0.4mm]";
const TABLE =
  "w-full border-collapse border border-t-0 border-[#444] print:border-[0.8pt] print:border-t-0 print:border-black";
const CELL =
  "whitespace-nowrap border border-[#999] px-[4px] py-[2px] text-[8px] print:border-[0.5pt] print:border-black print:px-[1.4mm] print:py-[1mm] print:text-[8.4pt]";
const UNIT_CELL =
  "overflow-hidden text-ellipsis whitespace-nowrap border border-[#999] px-[2px] py-[2px] text-[7.4px] print:border-[0.5pt] print:border-black print:px-[1mm] print:py-[0.8mm] print:text-[7.6pt]";
const HEAD_FILL =
  "bg-[#F2F3F5] text-center font-bold [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:bg-[#EDEDED]";
const UNIT_WIDTHS = ["7%", "11%", "6%", "6%", "6%", "12%", "16%", "13%", "7%", "6%", "6%", "9%"];
const UNIT_HEADS = ["호수", "이 름", "분류", "인원", "평형", "집전화", "핸드폰", "입주일자", "관리비", "인상후", "인상폭", "현관키"];
/** 정본 ` &nbsp;&nbsp; ` 간격. */
const GAP = " \u00a0\u00a0 ";

function NumberTable({ title, rows, withMeter }: { title: string; rows: CardNumberLine[]; withMeter: boolean }) {
  const heads = withMeter
    ? ["LIN", title, "계약성명", "구분", "계산", "검침", "출력", "기타적요"]
    : ["LIN", title, "계약성명", "구분", "계산", "기타적요"];
  // D8: 비어 있으면 머리행 + 빈 행 1줄.
  const lines: (CardNumberLine | null)[] = rows.length > 0 ? rows : [null];
  return (
    <table className={TABLE}>
      <thead>
        <tr>
          {heads.map((head) => (
            <th key={head} className={`${CELL} ${HEAD_FILL}`}>
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={line ? line.lin : `empty-${index}`}>
            <td className={`${CELL} text-center`}>{line ? line.lin : "\u00a0"}</td>
            <td className={`${CELL} text-center`}>{line?.customerNo}</td>
            <td className={`${CELL} text-center`}>{line?.holderName}</td>
            <td className={`${CELL} text-center`}>{line?.basis}</td>
            <td className={`${CELL} text-center`}>{line?.calculation}</td>
            {withMeter && (
              <>
                <td className={`${CELL} text-center`}>{line?.meterDay}</td>
                <td className={`${CELL} text-center`}>{line?.print}</td>
              </>
            )}
            <td className={CELL}>{line?.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 입주자카드 한 쪽(정본 cardForm). */
export function TenantCardSheet({ page, year, month }: { page: CardSheetPage; year: number; month: number }) {
  const { header, blocks } = page;
  return (
    <div className="font-['Pretendard',sans-serif] text-[8.4px] leading-[1.45] text-black print:text-[9pt] print:leading-[1.5]">
      <div className="mb-[8px] text-center text-[15px] font-extrabold tracking-[0.22em] print:mb-[4mm] print:text-[17pt] print:tracking-[0.2em]">
        &lt;&lt; 입 주 자 카 드 출 력 &gt;&gt;
      </div>
      <table className="w-full border-collapse border border-[#444] print:border-[0.8pt] print:border-black">
        <tbody>
          <tr>
            <td className={HEAD_CELL}>
              코드번호: <b>{header.code}</b>
            </td>
            <td className={HEAD_CELL}>동명칭: {header.dongName}</td>
            <td className={HEAD_CELL}>주소: {header.address}</td>
          </tr>
          <tr>
            <td className={HEAD_CELL}>
              빌라명칭: <b>{header.name}</b>
            </td>
            <td className={HEAD_CELL}>전화번호: {header.phone}</td>
            <td className={HEAD_CELL}>관리업체: {header.company}</td>
          </tr>
          <tr>
            <td className={HEAD_CELL} colSpan={3}>
              키번호: {header.keyLine}
            </td>
          </tr>
        </tbody>
      </table>
      <div className={BOX}>
        <div className={LABEL}>기타사항</div>
        <div className="min-h-[34px] min-w-0 flex-1 whitespace-pre-line text-[#666] print:min-h-[14mm] print:text-black">
          {header.memo}
        </div>
      </div>
      <div className={BOX}>
        <div className={LABEL}>청소사항 &gt;&gt;</div>
        <div className="min-w-0 flex-1">
          담당자: {blocks.cleaning.manager}
          {GAP}횟수: {blocks.cleaning.frequency}
          {GAP}요일: {blocks.cleaning.weekdays}
          {GAP}청소금액: {blocks.cleaning.amount}
          <br />
          비 고: {blocks.cleaning.remarks}
        </div>
      </div>
      <div className={BOX}>
        <div className={LABEL}>정화조 &gt;&gt;</div>
        <div className="min-w-0 flex-1">
          업체: {blocks.septic.vendor} {blocks.septic.phone}
          {GAP}금액: {blocks.septic.amount}
          {GAP}청구구분: {blocks.septic.billingType}
        </div>
      </div>
      <div className={BOX}>
        <div className={LABEL}>인터넷 &gt;&gt;</div>
        <div className="min-w-0 flex-1">
          업체: {blocks.internet.vendor}
          {GAP}명의자: {blocks.internet.holder}
          {GAP}금액: {blocks.internet.amount}
        </div>
      </div>
      <NumberTable title="수도고객번호" rows={page.water} withMeter />
      <NumberTable title="공용전기고객번호" rows={page.commonElec} withMeter={false} />
      <table className={`${TABLE} table-fixed`}>
        <colgroup>
          {UNIT_WIDTHS.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {UNIT_HEADS.map((head) => (
              <th key={head} className={`${UNIT_CELL} ${HEAD_FILL}`}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.units.map((unit) => (
            <tr key={unit.key}>
              <td className={`${UNIT_CELL} text-center`}>{unit.unitNo}</td>
              <td className={UNIT_CELL}>{unit.name}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.roomType}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.residents}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.area}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.homePhone}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.mobilePhone}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.moveIn}</td>
              <td className={`${UNIT_CELL} text-right tabular-nums`}>{unit.mgmtFee}</td>
              <td className={`${UNIT_CELL} text-right tabular-nums`}>{unit.afterIncrease}</td>
              <td className={`${UNIT_CELL} text-right tabular-nums`}>{unit.increase}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.entranceKey}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-[6px] text-right text-[8px] text-[#666] print:mt-[2mm] print:text-[8pt]">
        {page.building.name} · {year}년 {month}월 기준 · {page.pageIndex + 1} / {page.pageCount} 쪽
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ChargeStatementSheet.tsx`**

```tsx
import { Fragment } from "react";
import type { StatementSheetPage } from "./statementSheet";

// 정본 stmtForm. 화면 값은 인쇄 규칙(.cf-t2·.cf-stmt)을 화면 비율로 옮긴 값(스펙 §9.2), 인쇄 값은 §9.3.
const CELL =
  "whitespace-nowrap border border-[#999] px-[2px] py-[1px] text-[6px] leading-[1.3] print:border-[0.5pt] print:border-black print:px-[1mm] print:py-[0.5mm] print:text-[6.6pt]";
const HEAD_FILL = "bg-[#F2F3F5] [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:bg-[#EDEDED]";

/** 관리비부과내역서 한 쪽(정본 stmtForm). */
export function ChargeStatementSheet({ page, year, month }: { page: StatementSheetPage; year: number; month: number }) {
  return (
    <div className="font-['Pretendard',sans-serif] text-[8.4px] leading-[1.45] text-black print:text-[9pt] print:leading-[1.5]">
      <div className="mb-[6px] text-center text-[12px] font-extrabold print:mb-[3mm] print:text-[13pt]">
        [ {page.building.name} ]
      </div>
      <table className="w-full table-fixed border-collapse border border-t-0 border-[#444] print:border-[0.8pt] print:border-t-[0.8pt] print:border-black">
        <thead>
          <tr>
            <th className={`${CELL} ${HEAD_FILL} text-center font-bold`}>
              호<br />수
            </th>
            {page.groups.map((names, group) => (
              <th key={group} colSpan={2} className={`${CELL} ${HEAD_FILL} text-left font-semibold`}>
                {names[0] || "\u00a0"}
                <br />
                {names[1] || "\u00a0"}
                <br />
                {names[2] || "\u00a0"}
              </th>
            ))}
            <th className={`${CELL} ${HEAD_FILL} text-center font-semibold`}>
              전기전월
              <br />
              수도전월
            </th>
            <th className={`${CELL} ${HEAD_FILL} text-center font-semibold`}>
              전기금월
              <br />
              수도금월
            </th>
          </tr>
        </thead>
        {page.units.map((unit) => (
          <tbody key={unit.key} className="border-b border-black print:border-b-[1pt]">
            {unit.rows.map((cells, row) => (
              <tr key={row}>
                {row === 0 && (
                  <td rowSpan={3} className={`${CELL} text-center`}>
                    {unit.unitNo}
                  </td>
                )}
                {cells.map((cell, group) => (
                  <Fragment key={group}>
                    <td className={`${CELL} text-right tabular-nums`}>{cell.amount}</td>
                    <td className={`${CELL} text-center`}>{cell.flag}</td>
                  </Fragment>
                ))}
                {row === 0 && (
                  <>
                    <td rowSpan={3} className={`${CELL} text-right tabular-nums`}>
                      {unit.previous[0]}
                      <br />
                      {unit.previous[1]}
                    </td>
                    <td rowSpan={3} className={`${CELL} text-right tabular-nums`}>
                      {unit.current[0]}
                      <br />
                      {unit.current[1]}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <div className="mt-[6px] text-right text-[8px] text-[#666] print:mt-[2mm] print:text-[8pt]">
        {page.building.name} · {year}년 {month}월분 · {page.pageIndex + 1} / {page.pageCount} 쪽
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 검증** — `eslint` 두 파일, `tsc`에서 두 파일 오류 0.

- [ ] **Step 4: 커밋** — `git add "…/tenant-output/TenantCardSheet.tsx" "…/tenant-output/ChargeStatementSheet.tsx"` · `feat(buildings): 입주자카드·부과내역서 정본 양식 컴포넌트(화면·인쇄 겸용)`

---

### Task 5: 연결 — 쪽 모델·종이·모달·인쇄

**Files:** Modify(전체 교체) `…/tenant-output/outputPages.ts`, `…/components/TenantOutputModal.tsx` · Modify `…/tenant-output/PreviewPane.tsx` · Delete `…/tenant-output/TenantCardDocument.tsx`, `…/tenant-output/ChargeStatementDocument.tsx`, `…/tenant-output/statement.ts`

**Interfaces:** Consumes Tasks 2–4. Produces `buildOutputPages(selected, data, org)`, `PrintItem = { kind: "card"; page: CardSheetPage } | { kind: "statement"; page: StatementSheetPage }`, `printSequence`, `outputHint`, `mergeStatus`(시그니처는 1단계와 같음, 쪽 타입만 바뀜).

- [ ] **Step 1: `outputPages.ts` 전체 교체**

```ts
import type { Building } from "@/hooks/reactquery/buildings";
import type { OutputQueryStatus, TenantOutputBuildingData } from "@/hooks/reactquery/tenantOutput";
import { buildCardSheetPages, type CardOrgInfo, type CardSheetPage } from "./cardSheet";
import { buildStatementSheetPages, type StatementSheetPage } from "./statementSheet";

export interface BuildingOutputPages {
  building: Building;
  cards: CardSheetPage[];
  statements: StatementSheetPage[];
}

export interface OutputPages {
  /** 미리보기용 — 선택 건물(목록 순서)의 입주자카드 쪽을 이어 붙인 배열. */
  cards: CardSheetPage[];
  statements: StatementSheetPage[];
  cardStatus: OutputQueryStatus;
  statementStatus: OutputQueryStatus;
  /** 인쇄용 — 건물별 묶음. */
  byBuilding: BuildingOutputPages[];
}

/** 하나라도 로딩이면 로딩, 실패가 있으면 실패, 아니면 준비. */
export function mergeStatus(statuses: OutputQueryStatus[]): OutputQueryStatus {
  if (statuses.includes("loading")) return "loading";
  if (statuses.includes("error")) return "error";
  return "ready";
}

/** 선택 건물(목록 순서)과 건물별 조회 결과를 미리보기·인쇄용 쪽으로 펼친다. 조회가 끝난 건물만 쪽을 만든다. */
export function buildOutputPages(selected: Building[], data: TenantOutputBuildingData[], org: CardOrgInfo): OutputPages {
  const dataById = new Map(data.map((entry) => [entry.buildingId, entry]));
  const byBuilding = selected.map((building): BuildingOutputPages => {
    const entry = dataById.get(building.id);
    const cards =
      entry?.cardStatus === "ready" ? buildCardSheetPages(building, entry.buildingFull, entry.cardRows, org) : [];
    const statements =
      entry?.statementStatus === "ready"
        ? buildStatementSheetPages(building, entry.documents, entry.feeItems, entry.elecRows, entry.waterRows)
        : [];
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
export type PrintItem = { kind: "card"; page: CardSheetPage } | { kind: "statement"; page: StatementSheetPage };

/** 인쇄 순서(PDF): 둘 다 = 건물별 [카드 → 내역서], 카드만·내역서만 = 그 문서만 건물 순서대로. */
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

- [ ] **Step 2: `PreviewPane.tsx` — 종이 안쪽 여백·축소 제거**

`import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";` → `import { type ReactNode, useLayoutEffect, useRef, useState } from "react";`. `DOC_ZOOM`·`docStyle` 두 상수와 그 위 주석 삭제. `PaperPage`의 종이 div 클래스에 `px-[34px] py-[40px]` 추가(정본 `.pm-page{padding:40px 34px}`), `<div style={docStyle}>{children}</div>` → `{children}`.

- [ ] **Step 3: `TenantOutputModal.tsx` 전체 교체**

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, DocumentIcon, PrinterIcon } from "@/components/icons";
import { Button, CustomDropdown } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillOrganizationName } from "@/hooks/reactquery/bill";
import { useBuildings, useStaffOptions } from "@/hooks/reactquery/buildings";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { useTenantOutputData } from "@/hooks/reactquery/tenantOutput";
import { currentPeriod } from "@/lib/billing/period";
import { BuildingPickerList } from "./tenant-output/BuildingPickerList";
import { ChargeStatementSheet } from "./tenant-output/ChargeStatementSheet";
import type { CardOrgInfo } from "./tenant-output/cardSheet";
import { PreviewPane } from "./tenant-output/PreviewPane";
import { TenantCardSheet } from "./tenant-output/TenantCardSheet";
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

// 정본 doPrint: A4 세로 여백 11mm, 인쇄 시트만 남기고 나머지는 숨긴다(시트는 body 직속 포털 — D11).
const PRINT_CSS =
  "@media print { @page { size: A4 portrait; margin: 11mm; } body > *:not([data-print-sheet]) { display: none !important; } }";

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
  // 정본 openModal: 선택 없이 연다.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [cardPage, setCardPage] = useState(0);
  const [statementPage, setStatementPage] = useState(0);
  const [printScope, setPrintScope] = useState<PrintScope | null>(null);

  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: allBuildings = [] } = useBuildings();
  const buildings = useMemo(() => allBuildings.filter((building) => building.orgId === orgId), [allBuildings, orgId]);
  const { data: orgName } = useBillOrganizationName(orgId);
  const { data: setup } = useSetupConfig(orgId);
  const { data: orgContact } = useOrgContact();
  const { data: accounts = [] } = useStaffOptions();
  // 스펙 §4.1: 관리업체 = 설정 회사명 → 조직명, 전화번호 = 회사 대표전화 → 조직 전화.
  const org = useMemo<CardOrgInfo>(
    () => ({
      companyName: setup?.companyName?.trim() || orgName || "",
      companyPhone: setup?.companyPhone?.trim() || orgContact?.phone || "",
      cleaningManagerName: (userId) => (userId ? (accounts.find((account) => account.userId === userId)?.fullName ?? "") : ""),
    }),
    [setup, orgName, orgContact, accounts],
  );

  // 표시·조회·인쇄 순서는 항상 건물 목록 순서다(정본 selBlds).
  const selected = useMemo(() => buildings.filter((building) => selectedIds.has(building.id)), [buildings, selectedIds]);
  const period = `${year}-${String(month).padStart(2, "0")}-01`;
  const outputData = useTenantOutputData(selected, period);
  const pages = buildOutputPages(selected, outputData, org);

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
                    {card && <TenantCardSheet page={card} year={year} month={month} />}
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
                    {statement && <ChargeStatementSheet page={statement} year={year} month={month} />}
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

      {printItems.length > 0 &&
        createPortal(
          <div data-print-sheet className="hidden bg-white text-black print:block">
            <style>{PRINT_CSS}</style>
            {printItems.map((item) => (
              <section key={item.page.key} className="break-after-page last:break-after-auto">
                {item.kind === "card" ? (
                  <TenantCardSheet page={item.page} year={year} month={month} />
                ) : (
                  <ChargeStatementSheet page={item.page} year={year} month={month} />
                )}
              </section>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
```

- [ ] **Step 4: 옛 문서 삭제** — `TenantCardDocument.tsx`·`ChargeStatementDocument.tsx`·`statement.ts` 삭제. 삭제 전 `grep -rn "TenantCardDocument\|ChargeStatementDocument\|tenant-output/statement" app components hooks lib`로 다른 사용처 0 확인.

- [ ] **Step 5: 검증(이제 전체)** — `tsc` 오류 0(다른 세션 파일 오류는 별도 보고), `eslint` Task 5 파일 전부.

- [ ] **Step 6: 커밋** — `git add` Task 5 파일(삭제 포함) · `feat(buildings): 출력 모달 양식 교체 연결 — 정본 입주자카드·부과내역서, 종이 여백, 인쇄 격리(A4 11mm)`

---

### Task 6: 검증·병합

- [ ] **Step 1: dev 서버** — 정션(없으면 생성) + `.env.local` 복사 → `node ./node_modules/next/dist/bin/next dev --webpack -p 3127`.
- [ ] **Step 2: 미리보기 점검(헤드리스 1305×888)** — 2곳(그린빌라·블루타워) 선택 → 카드·내역서 패널 캡처, 종이 안 첫 요소가 `<< 입 주 자 카 드 출 력 >>`·`[ 그린빌라 ]`인지, 카드 머리 3행·블록 4개·고객번호 표 2개·세대 표 12열, 내역서 머리 `호/수`+열 수(max(6,⌈n/3⌉))+검침 2칸, 쪽수 = 스펙 D2·D3.
- [ ] **Step 3: 인쇄 PDF** — `window.print` 스텁 → 세 버튼 각각 누른 뒤 `page.emulateMedia({ media: "print" })` + `page.pdf({ preferCSSPageSize: true, printBackground: true })`. 쪽수 = Σ(카드쪽)+Σ(내역서쪽)(버튼별), 쪽 순서 = 건물별 카드 → 내역서, 첫 쪽에 앱 화면 요소(사이드바·표·"건물·입주자 관리") 없음(RF5). PDF를 열어 정본 PDF와 양식 모양(제목·블록·표 머리·하단 문구)을 눈으로 대조.
- [ ] **Step 4: RF1~RF4** — 업체·고객번호 없는 건물(블록 값 빈칸·고객번호 빈 행), 공실 행(`N 공실`), 항목 수와 열 수, 미확정 건물 섞기(내역서 0쪽·인쇄 순서).
- [ ] **Step 5: 정리·병합** — dev 서버 종료, `.env.local`·`.next` 삭제, 내가 만든 정션만 제거. **병합은 이 계획의 커밋만**: `git log origin/master..HEAD`에 다른 세션 커밋이 있으면 origin/master에서 임시 브랜치를 만들어 내 커밋만 cherry-pick → 그 브랜치를 master에 `--no-ff` 병합. push. WBS(f58675ab 비고 날짜 항목·통계 줄), 메모리 갱신.
