# P5b 고지서 발행·출력(지로/A4 출력 코어) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부과확정된 관리비를 세대별 지로/A4 고지서로 브라우저 인쇄하는 읽기전용 화면 `/staff/bill`을 만든다.

**Architecture:** 신규 라우트 `app/(staff)/staff/bill`. 기존 `useBilling`(부과확정 데이터)·`getSetupConfig`(입금계좌)를 재사용해 데이터를 읽고, 순수 빌더 `lib/billing/billDoc.ts`로 세대→고지서 표시모델을 만든 뒤 `BillPreview`가 렌더한다. 인쇄는 `@media print` + `window.print()`. 새 DB/RPC/마이그레이션 없음.

**Tech Stack:** Next.js 16(App Router, `"use client"`), React Query, TypeScript, TailwindCSS, Vitest + React Testing Library, sonner(toast), qrcode(신규).

## Global Constraints

- **읽기 전용**: 새 Supabase 마이그레이션·RPC·테이블 **금지**. 기존 `list_billing`(via `useBilling`)·`setup_config`만 읽는다.
- **발행 대상 = 부과확정분만**: `BillingFlatRow.confirmedAt != null`인 세대만 목록·발행. 공실(`isVacant`) 제외.
- **모듈 키**: `bill_publish`는 이미 `lib/auth/permissions.ts`의 `MODULE_KEYS`에 존재 → 신규 추가 금지. 게이트는 `hasModule(me, "bill_publish")`.
- **출력**: 브라우저 print(`window.print()` + `@media print`)만. 서버 PDF·외부 발송(카톡·팩스) 금지(후속).
- **출력 옵션은 transient**: 코드/이름 표기·단수 표기·납기일은 로컬 state, DB 저장 금지.
- **회사명**: `BillPreview`는 `companyName?: string` optional. MVP는 미전달(소스 미확정 → 후속). 없으면 회사명 영역 생략.
- **재사용 심볼(변경 금지, import만)**: `useBilling(buildingId, period)`(`@/hooks/reactquery/billing`), `pivotBillingRows`·`BillingUnitRow`·`BillingColumn`(`@/lib/billing/pivot`), `unitTotal`(`@/lib/billing/total`), `currentPeriod`/`toMonthInput`/`fromMonthInput`(`@/lib/billing/period`), `useBuildings`(`@/hooks/reactquery/buildings`), `useMe`(`@/hooks/reactquery/auth`), `useSetupConfig`(`@/hooks/reactquery/setupConfig`), `hasModule`(`@/lib/auth/permissions`), `Button`/`Select`/`EmptyState`/`Spinner`/`Modal`(`@/components/common`), `toast`(`sonner`).
- **정적 검사**: 각 그룹 종료 시 `npx tsc --noEmit` + `npm run lint` 0.
- **Next 주의(AGENTS.md)**: 신규 `page.tsx`는 `"use client"`. 훅 시그니처·`<input type=month>`·`@media print` 레이아웃은 구현 전 `node_modules/next/dist/docs/` 확인.

---

## File Structure

**신규 생성**
- `app/(staff)/staff/bill/page.tsx` — 화면 컨테이너(권한 게이트·건물/월 선택·발행유형·출력옵션·상태분기·인쇄 트리거).
- `app/(staff)/staff/bill/page.test.tsx` — 페이지 테스트.
- `app/(staff)/staff/bill/components/BillTargetTable.tsx` — 확정분 세대 목록 + 전체/개별 선택.
- `app/(staff)/staff/bill/components/BillTargetTable.test.tsx`
- `app/(staff)/staff/bill/components/BillPreview.tsx` — 지로/A4 고지서 렌더(인쇄 영역).
- `app/(staff)/staff/bill/components/BillPreview.test.tsx`
- `app/(staff)/staff/bill/components/QRCode.tsx` — 클라이언트 QR 렌더 래퍼.
- `lib/billing/billDoc.ts` — 순수 빌더: 세대(pivot) + 컬럼 + 계좌 + 옵션 → 고지서 표시모델.
- `lib/billing/billDoc.test.ts`

**수정**
- `components/shell/navItems.ts` — 고지서 발행 항목 `built: false` → `true`.
- `app/globals.css` — `@media print` 블록 추가.
- `package.json` — `qrcode` + `@types/qrcode` 의존성(그룹2 Task 4).

**변경 금지(참조만)**: `lib/auth/permissions.ts`(bill_publish 이미 존재), `hooks/reactquery/billing/*`, `lib/billing/{pivot,total,period}.ts`, `hooks/reactquery/setupConfig/*`, `components/shell/Sidebar.tsx`.

---

# 그룹 1 — 골격·데이터·목록

## Task 1: 네비 활성화 (고지서 발행 링크)

**Files:**
- Modify: `components/shell/navItems.ts` (고지서 발행 항목 `built` 플래그)
- Test: `components/shell/navItems.test.ts` (없으면 생성)

**Interfaces:**
- Consumes: `NAV_GROUPS`(`@/components/shell/navItems`), `NavItem { label; href; module?; built; icon }`.
- Produces: 고지서 발행 항목 `{ href: "/staff/bill", module: "bill_publish", built: true }`.

- [ ] **Step 1: 실패 테스트 작성** — `components/shell/navItems.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { NAV_GROUPS } from "./navItems";

describe("navItems", () => {
  it("고지서 발행 항목이 활성(built:true)이고 /staff/bill·bill_publish 게이트", () => {
    const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === "/staff/bill");
    expect(item).toBeDefined();
    expect(item!.module).toBe("bill_publish");
    expect(item!.built).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run navItems`
Expected: FAIL — `expected false to be true` (현재 `built: false`).

- [ ] **Step 3: 최소 구현** — `components/shell/navItems.ts` 라인 36의 고지서 발행 항목에서 `built: false` → `built: true`. (해당 객체만 변경, 다른 필드·icon 유지.)

```typescript
{ label: "고지서 발행", href: "/staff/bill", module: "bill_publish", built: true, icon: "M5 3h14a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h4" },
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run navItems`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add components/shell/navItems.ts components/shell/navItems.test.ts
git commit -m "feat(bill): GNB 고지서 발행 링크 활성화(built:true)"
```

---

## Task 2: `/staff/bill` 페이지 골격 (권한·건물·월·상태)

**Files:**
- Create: `app/(staff)/staff/bill/page.tsx`
- Test: `app/(staff)/staff/bill/page.test.tsx`

**Interfaces:**
- Consumes: `useMe()`→`{data:{orgId,role,permissions}}`, `useBuildings()`→`{data:Building[],isLoading}` (`Building{id,name,typeId}`), `useBilling(buildingId:number|null, period:string)`→`{data:BillingFlatRow[],isLoading,error}`, `useSetupConfig(orgId?)`→`{data:SetupConfig|null}`, `hasModule(me,"bill_publish")`, `currentPeriod()`/`toMonthInput()`/`fromMonthInput()`, `Select`/`EmptyState`/`Spinner`/`Button`.
- Produces: default export `BillPage`. 상태: `buildingId`, `period`, `issueType:"giro"|"a4"`, `labelMode:"code"|"name"`, `selected:Set<number>`(세대 unitId). (BillTargetTable·BillPreview는 Task 3·6에서 채움 — 이 태스크는 자리표시 없이 상단 액션·상태분기까지만.)

- [ ] **Step 1: 실패 테스트 작성** — `app/(staff)/staff/bill/page.test.tsx`

```typescript
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/billing", () => ({ useBilling: vi.fn() }));
vi.mock("@/hooks/reactquery/setupConfig", () => ({ useSetupConfig: vi.fn(() => ({ data: null })) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import BillPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBilling } from "@/hooks/reactquery/billing";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 10, role: "org_owner", permissions: [] } } as never);
  vi.mocked(useBuildings).mockReturnValue({ data: [{ id: 7, name: "가나빌", typeId: 1 }], isLoading: false } as never);
  vi.mocked(useBilling).mockReturnValue({ data: [], isLoading: false, error: null } as never);
});

describe("bill page (골격)", () => {
  it("bill_publish 권한 없으면 접근 차단", () => {
    vi.mocked(useMe).mockReturnValue({ data: { orgId: 10, role: "staff", permissions: [] } } as never);
    render(<BillPage />);
    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
  });

  it("권한 있고 건물 미선택 시 안내", () => {
    render(<BillPage />);
    expect(screen.getByLabelText("건물 선택")).toBeInTheDocument();
    expect(screen.getByText(/건물을 선택/)).toBeInTheDocument();
  });

  it("건물 선택했으나 부과확정 세대 없으면 미확정 안내", () => {
    vi.mocked(useBilling).mockReturnValue({
      data: [{ unitId: 1, unitNo: "101", confirmedAt: null, isVacant: false, feeItemId: 10, feeItemName: "관리비", charged: true, amount: 30000, tenantName: "홍길동", moveInDate: "2026-07-01", dong: null, roomTypeLabel: null, occupancyId: 5, carryOver: false, dailyProration: false, rounding: "raw", isRequired: true, sortOrder: 0, confirmedByName: null, totalAmount: null, billingNote: null, unitNotice: null, isDirty: false }],
      isLoading: false, error: null,
    } as never);
    const { container } = render(<BillPage />);
    // 건물 선택 시뮬레이션: Select onChange
    const select = screen.getByLabelText("건물 선택") as HTMLSelectElement;
    select.value = "7";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(container.textContent).toMatch(/부과 확정된 세대가 없습니다/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run bill`
Expected: FAIL — `Cannot find module './page'`.

- [ ] **Step 3: 최소 구현** — `app/(staff)/staff/bill/page.tsx`

```typescript
"use client";
import React, { useMemo, useState } from "react";
import { Select, EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBilling } from "@/hooks/reactquery/billing";
import { hasModule } from "@/lib/auth/permissions";
import { pivotBillingRows } from "@/lib/billing/pivot";
import { currentPeriod, toMonthInput, fromMonthInput } from "@/lib/billing/period";

export default function BillPage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState<string>(() => currentPeriod());
  const billingQuery = useBilling(buildingId, period);

  const buildings = buildingsQuery.data ?? [];
  const { units, columns } = useMemo(() => pivotBillingRows(billingQuery.data ?? []), [billingQuery.data]);
  const confirmedUnits = useMemo(
    () => units.filter((u) => u.confirmedAt != null && !u.isVacant),
    [units],
  );

  if (me === undefined) return null;
  if (!hasModule(me, "bill_publish")) {
    return <div className="p-6"><EmptyState message="이 화면에 접근할 권한이 없습니다. (고지서 발행 권한 필요)" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-bold text-t1">고지서 발행·출력</h1>
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-64">
          <span className="mb-1.5 block text-xs font-bold text-t2">건물 선택</span>
          <Select
            aria-label="건물 선택"
            value={buildingId?.toString() ?? ""}
            onChange={(e) => setBuildingId(e.target.value ? Number(e.target.value) : null)}
            disabled={buildingsQuery.isLoading}
            options={[
              { value: "", label: buildingsQuery.isLoading ? "건물 불러오는 중" : "건물을 선택해 주세요" },
              ...buildings.map((b) => ({ value: String(b.id), label: b.name })),
            ]}
          />
        </label>
        <label className="w-40">
          <span className="mb-1.5 block text-xs font-bold text-t2">부과월</span>
          <input
            type="month"
            aria-label="부과월"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            value={toMonthInput(period)}
            max={toMonthInput(currentPeriod())}
            onChange={(e) => e.target.value && setPeriod(fromMonthInput(e.target.value))}
          />
        </label>
      </div>

      {buildingId == null && <EmptyState message="건물을 선택해 주세요." />}
      {buildingId != null && billingQuery.isLoading && <div className="py-10 text-center"><Spinner /></div>}
      {buildingId != null && billingQuery.error != null && (
        <EmptyState message="불러오지 못했습니다. 다시 시도해 주세요." />
      )}
      {buildingId != null && !billingQuery.isLoading && billingQuery.error == null && confirmedUnits.length === 0 && (
        <EmptyState message="부과 확정된 세대가 없습니다. 부과 확정 화면에서 먼저 확정해 주세요." />
      )}
      {/* Task 3: 확정분 목록(BillTargetTable) / Task 6: 미리보기·인쇄 */}
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run bill`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/bill/page.tsx" "app/(staff)/staff/bill/page.test.tsx"
git commit -m "feat(bill): /staff/bill 페이지 골격(권한·건물·월·상태 분기)"
```

---

## Task 3: 확정분 세대 목록 (BillTargetTable)

**Files:**
- Create: `app/(staff)/staff/bill/components/BillTargetTable.tsx`
- Test: `app/(staff)/staff/bill/components/BillTargetTable.test.tsx`
- Modify: `app/(staff)/staff/bill/page.tsx` (테이블 배선 + `selected` state)

**Interfaces:**
- Consumes: `BillingUnitRow`(`@/lib/billing/pivot`), `unitTotal`(`@/lib/billing/total`), `BillingColumn`.
- Produces: `BillTargetTable({ units, columns, period, labelMode, selected, onToggle, onToggleAll })` — props 타입:
  ```typescript
  export interface BillTargetTableProps {
    units: BillingUnitRow[];
    columns: BillingColumn[];
    period: string;
    labelMode: "code" | "name";
    selected: Set<number>;               // unitId 집합
    onToggle: (unitId: number) => void;
    onToggleAll: (checked: boolean) => void;
  }
  ```

- [ ] **Step 1: 실패 테스트 작성** — `app/(staff)/staff/bill/components/BillTargetTable.test.tsx`

```typescript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillTargetTable } from "./BillTargetTable";
import type { BillingUnitRow, BillingColumn } from "@/lib/billing/pivot";

const columns: BillingColumn[] = [
  { feeItemId: 10, name: "관리비", carryOver: false, dailyProration: false, rounding: "raw", isRequired: true, sortOrder: 0 },
];
const units: BillingUnitRow[] = [
  { unitId: 1, unitNo: "101", dong: null, roomTypeLabel: null, occupancyId: 5, tenantName: "홍길동", moveInDate: "2026-07-01", isVacant: false, confirmedAt: "2026-08-13T00:00:00Z", confirmedByName: "관리자", totalAmount: 30000, billingNote: null, unitNotice: null, isDirty: false, charges: { 10: { charged: true, amount: 30000 } } },
];

describe("BillTargetTable", () => {
  it("세대 행과 합계·입주자명 표시(labelMode=name)", () => {
    render(<BillTargetTable units={units} columns={columns} period="2026-08-01" labelMode="name" selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} />);
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("30,000")).toBeInTheDocument();
  });

  it("labelMode=code면 호실코드 표시", () => {
    render(<BillTargetTable units={units} columns={columns} period="2026-08-01" labelMode="code" selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} />);
    expect(screen.getByText("101")).toBeInTheDocument();
  });

  it("개별 체크박스 클릭 시 onToggle(unitId)", () => {
    const onToggle = vi.fn();
    render(<BillTargetTable units={units} columns={columns} period="2026-08-01" labelMode="name" selected={new Set()} onToggle={onToggle} onToggleAll={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("101 선택"));
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("전체 선택 체크박스 클릭 시 onToggleAll(true)", () => {
    const onToggleAll = vi.fn();
    render(<BillTargetTable units={units} columns={columns} period="2026-08-01" labelMode="name" selected={new Set()} onToggle={vi.fn()} onToggleAll={onToggleAll} />);
    fireEvent.click(screen.getByLabelText("전체 선택"));
    expect(onToggleAll).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run BillTargetTable`
Expected: FAIL — `Cannot find module './BillTargetTable'`.

- [ ] **Step 3: 최소 구현** — `app/(staff)/staff/bill/components/BillTargetTable.tsx`

```typescript
import React from "react";
import type { BillingUnitRow, BillingColumn } from "@/lib/billing/pivot";
import { unitTotal } from "@/lib/billing/total";

export interface BillTargetTableProps {
  units: BillingUnitRow[];
  columns: BillingColumn[];
  period: string;
  labelMode: "code" | "name";
  selected: Set<number>;
  onToggle: (unitId: number) => void;
  onToggleAll: (checked: boolean) => void;
}

export function BillTargetTable({ units, columns, period, labelMode, selected, onToggle, onToggleAll }: BillTargetTableProps) {
  const allChecked = units.length > 0 && units.every((u) => selected.has(u.unitId));
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-line text-left text-xs text-t3">
          <th className="p-2 w-10">
            <input type="checkbox" aria-label="전체 선택" checked={allChecked} onChange={(e) => onToggleAll(e.target.checked)} />
          </th>
          <th className="p-2">호실</th>
          <th className="p-2">입주자</th>
          <th className="p-2 text-right">합계</th>
        </tr>
      </thead>
      <tbody>
        {units.map((u) => {
          const lines = columns
            .filter((c) => u.charges[c.feeItemId]?.charged)
            .map((c) => ({ amount: u.charges[c.feeItemId]!.amount, dailyProration: c.dailyProration, rounding: c.rounding }));
          const total = u.totalAmount ?? unitTotal(lines, u.moveInDate, period);
          return (
            <tr key={u.unitId} className="border-b border-line/60">
              <td className="p-2">
                <input type="checkbox" aria-label={`${u.unitNo} 선택`} checked={selected.has(u.unitId)} onChange={() => onToggle(u.unitId)} />
              </td>
              <td className="p-2">{u.unitNo}</td>
              <td className="p-2">{labelMode === "code" ? u.unitNo : (u.tenantName ?? "-")}</td>
              <td className="p-2 text-right tabular-nums">{total.toLocaleString("ko-KR")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

> **주의**: `unitTotal`의 `lines` 인자 형태(`ChargeLine`)를 `@/lib/billing/total.ts`에서 확인해 맞춘다. 위 `{amount,dailyProration,rounding}`가 다르면 실제 타입에 맞게 map 조정(확정분은 `u.totalAmount` 우선이라 대부분 이 경로 사용).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run BillTargetTable`
Expected: PASS (4 tests).

- [ ] **Step 5: page.tsx 배선** — `selected` state + 미확정 아닌 경우 테이블 렌더. `page.tsx`의 상태 선언에 추가:

```typescript
  const [labelMode, setLabelMode] = useState<"code" | "name">("name");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(confirmedUnits.map((u) => u.unitId)) : new Set());
  // columns는 Task 2의 useMemo에서 units와 함께 구조분해됨(재호출 불필요).
```

`{/* Task 3 */}` 자리에 렌더:

```tsx
{buildingId != null && !billingQuery.isLoading && billingQuery.error == null && confirmedUnits.length > 0 && (
  <BillTargetTable units={confirmedUnits} columns={columns} period={period} labelMode={labelMode} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
)}
```

`import { BillTargetTable } from "./components/BillTargetTable";` 추가. 건물/월 변경 시 `selected` 초기화(`useEffect([buildingId, period]) → setSelected(new Set())`).

- [ ] **Step 6: 페이지 테스트 보강 + 통과 확인** — `page.test.tsx`에 확정분 1건 mock 시 테이블·체크박스 표시 케이스 추가 후:

Run: `npx vitest run bill`
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add "app/(staff)/staff/bill/"
git commit -m "feat(bill): 확정분 세대 목록·선택(BillTargetTable) + 페이지 배선"
```

- [ ] **Step 8: 그룹1 정적검사**

Run: `npx tsc --noEmit` · `npm run lint`
Expected: 에러 0.

---

# 그룹 2 — 렌더·인쇄

## Task 4: QR 의존성 + QRCode 컴포넌트

**Files:**
- Modify: `package.json` (의존성) — **Claude가 설치**(`npm install qrcode` + `npm install -D @types/qrcode`; codex 샌드박스 불가).
- Create: `app/(staff)/staff/bill/components/QRCode.tsx`
- Test: `app/(staff)/staff/bill/components/QRCode.test.tsx`

**Interfaces:**
- Produces: `QRCode({ value, size }: { value: string; size?: number })` — `value`를 QR로 렌더(`<canvas>` 또는 dataURL `<img>`).

- [ ] **Step 1: 의존성 설치 (Claude)**

```bash
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: 실패 테스트 작성** — `QRCode.test.tsx`

```typescript
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") } }));
import { QRCode } from "./QRCode";

describe("QRCode", () => {
  it("value로 img(alt=QR코드) 렌더", async () => {
    const { findByAltText } = render(<QRCode value="https://example.com/bill/1" />);
    const img = await findByAltText("QR코드");
    expect(img).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run QRCode`
Expected: FAIL — `Cannot find module './QRCode'`.

- [ ] **Step 4: 최소 구현** — `QRCode.tsx`

```typescript
"use client";
import React, { useEffect, useState } from "react";
import QR from "qrcode";

export function QRCode({ value, size = 96 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QR.toDataURL(value, { width: size, margin: 0 }).then((d) => { if (alive) setSrc(d); }).catch(() => {});
    return () => { alive = false; };
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size }} aria-hidden />;
  return <img src={src} width={size} height={size} alt="QR코드" />;
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run QRCode`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json "app/(staff)/staff/bill/components/QRCode.tsx" "app/(staff)/staff/bill/components/QRCode.test.tsx"
git commit -m "feat(bill): 클라이언트 QR 렌더 컴포넌트 + qrcode 의존성"
```

---

## Task 5: 고지서 표시모델 빌더 (lib/billing/billDoc.ts)

**Files:**
- Create: `lib/billing/billDoc.ts`
- Test: `lib/billing/billDoc.test.ts`

**Interfaces:**
- Consumes: `BillingUnitRow`·`BillingColumn`(`@/lib/billing/pivot`), `unitTotal`(`@/lib/billing/total`), `SetupConfig`(`@/hooks/reactquery/setupConfig`).
- Produces:
  ```typescript
  export interface BillDocOptions { labelMode: "code" | "name"; dueDate?: string; showCutoff?: boolean; }
  export interface BillLine { name: string; amount: number; }
  export interface BillAccount { bank: string; acct: string; holder: string; }
  export interface BillDocument {
    unitId: number; title: string;            // 코드/이름
    unitNo: string; tenantName: string | null;
    period: string; dueDate: string | null;
    lines: BillLine[]; total: number;
    accounts: BillAccount[]; showCutoff: boolean;
    qrValue: string;                           // QR payload(MVP: /staff/bill 식별용 문자열)
  }
  export function buildBillDocument(
    unit: BillingUnitRow, columns: BillingColumn[], config: SetupConfig | null,
    period: string, opts: BillDocOptions,
  ): BillDocument
  ```

- [ ] **Step 1: 실패 테스트 작성** — `lib/billing/billDoc.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { buildBillDocument } from "./billDoc";
import type { BillingUnitRow, BillingColumn } from "./pivot";
import type { SetupConfig } from "@/hooks/reactquery/setupConfig/apis";

const columns: BillingColumn[] = [
  { feeItemId: 10, name: "관리비", carryOver: false, dailyProration: false, rounding: "raw", isRequired: true, sortOrder: 0 },
  { feeItemId: 11, name: "승강기유지비", carryOver: false, dailyProration: false, rounding: "raw", isRequired: false, sortOrder: 1 },
];
const unit: BillingUnitRow = {
  unitId: 1, unitNo: "101", dong: null, roomTypeLabel: null, occupancyId: 5, tenantName: "홍길동",
  moveInDate: "2026-07-01", isVacant: false, confirmedAt: "2026-08-13T00:00:00Z", confirmedByName: "관리자",
  totalAmount: 35000, billingNote: null, unitNotice: null, isDirty: false,
  charges: { 10: { charged: true, amount: 30000 }, 11: { charged: true, amount: 5000 } },
};
const config = { mgmtBank1: "국민", mgmtAcct1: "123", mgmtHolder1: "관리단", mgmtPrint1: true, mgmtBank2: null, mgmtAcct2: null, mgmtHolder2: null, mgmtPrint2: false } as unknown as SetupConfig;

describe("buildBillDocument", () => {
  it("charged 항목만 lines, 확정 totalAmount 우선", () => {
    const doc = buildBillDocument(unit, columns, config, "2026-08-01", { labelMode: "name" });
    expect(doc.lines).toEqual([{ name: "관리비", amount: 30000 }, { name: "승강기유지비", amount: 5000 }]);
    expect(doc.total).toBe(35000);
  });
  it("labelMode=code면 title=호실코드, name이면 입주자명", () => {
    expect(buildBillDocument(unit, columns, config, "2026-08-01", { labelMode: "code" }).title).toBe("101");
    expect(buildBillDocument(unit, columns, config, "2026-08-01", { labelMode: "name" }).title).toBe("홍길동");
  });
  it("mgmtPrint1=true 계좌만 포함", () => {
    const doc = buildBillDocument(unit, columns, config, "2026-08-01", { labelMode: "name" });
    expect(doc.accounts).toEqual([{ bank: "국민", acct: "123", holder: "관리단" }]);
  });
  it("charged=false 항목 제외 + config null 안전", () => {
    const u2 = { ...unit, totalAmount: null, charges: { 10: { charged: true, amount: 30000 }, 11: { charged: false, amount: 5000 } } };
    const doc = buildBillDocument(u2, columns, null, "2026-08-01", { labelMode: "name" });
    expect(doc.lines).toEqual([{ name: "관리비", amount: 30000 }]);
    expect(doc.total).toBe(30000);         // totalAmount null → unitTotal 합
    expect(doc.accounts).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run billDoc`
Expected: FAIL — `Cannot find module './billDoc'`.

- [ ] **Step 3: 최소 구현** — `lib/billing/billDoc.ts`

```typescript
import type { BillingUnitRow, BillingColumn } from "./pivot";
import { unitTotal } from "./total";
import type { SetupConfig } from "@/hooks/reactquery/setupConfig/apis";

export interface BillDocOptions { labelMode: "code" | "name"; dueDate?: string; showCutoff?: boolean; }
export interface BillLine { name: string; amount: number; }
export interface BillAccount { bank: string; acct: string; holder: string; }
export interface BillDocument {
  unitId: number; title: string; unitNo: string; tenantName: string | null;
  period: string; dueDate: string | null; lines: BillLine[]; total: number;
  accounts: BillAccount[]; showCutoff: boolean; qrValue: string;
}

function accounts(config: SetupConfig | null): BillAccount[] {
  if (!config) return [];
  const out: BillAccount[] = [];
  if (config.mgmtPrint1 && config.mgmtBank1 && config.mgmtAcct1) out.push({ bank: config.mgmtBank1, acct: config.mgmtAcct1, holder: config.mgmtHolder1 ?? "" });
  if (config.mgmtPrint2 && config.mgmtBank2 && config.mgmtAcct2) out.push({ bank: config.mgmtBank2, acct: config.mgmtAcct2, holder: config.mgmtHolder2 ?? "" });
  return out;
}

export function buildBillDocument(
  unit: BillingUnitRow, columns: BillingColumn[], config: SetupConfig | null,
  period: string, opts: BillDocOptions,
): BillDocument {
  const active = columns.filter((c) => unit.charges[c.feeItemId]?.charged);
  const lines: BillLine[] = active.map((c) => ({ name: c.name, amount: unit.charges[c.feeItemId]!.amount }));
  const computed = unitTotal(
    active.map((c) => ({ amount: unit.charges[c.feeItemId]!.amount, dailyProration: c.dailyProration, rounding: c.rounding })),
    unit.moveInDate, period,
  );
  return {
    unitId: unit.unitId,
    title: opts.labelMode === "code" ? unit.unitNo : (unit.tenantName ?? unit.unitNo),
    unitNo: unit.unitNo, tenantName: unit.tenantName,
    period, dueDate: opts.dueDate ?? null,
    lines, total: unit.totalAmount ?? computed,
    accounts: accounts(config), showCutoff: !!opts.showCutoff,
    qrValue: `bill:${unit.unitId}:${period}`,
  };
}
```

> **주의**: `unitTotal`의 `lines` 인자 실제 타입(`ChargeLine`)을 `total.ts`에서 확인해 map 형태를 맞춘다. `SetupConfig`의 계좌 필드명(`mgmtBank1`…)은 §7 verbatim 확인됨.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run billDoc`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/billing/billDoc.ts lib/billing/billDoc.test.ts
git commit -m "feat(bill): 고지서 표시모델 순수 빌더(buildBillDocument)"
```

---

## Task 6: 고지서 렌더 (BillPreview)

**Files:**
- Create: `app/(staff)/staff/bill/components/BillPreview.tsx`
- Test: `app/(staff)/staff/bill/components/BillPreview.test.tsx`

**Interfaces:**
- Consumes: `BillDocument`(`@/lib/billing/billDoc`), `QRCode`(`./QRCode`).
- Produces:
  ```typescript
  export interface BillPreviewProps {
    docs: BillDocument[];
    issueType: "giro" | "a4";
    companyName?: string;              // MVP 미전달(§ Global Constraints)
  }
  export function BillPreview(props: BillPreviewProps): JSX.Element
  ```

- [ ] **Step 1: 실패 테스트 작성** — `BillPreview.test.tsx`

```typescript
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("./QRCode", () => ({ QRCode: ({ value }: { value: string }) => <div data-testid="qr">{value}</div> }));
import { BillPreview } from "./BillPreview";
import type { BillDocument } from "@/lib/billing/billDoc";

const doc: BillDocument = {
  unitId: 1, title: "홍길동", unitNo: "101", tenantName: "홍길동", period: "2026-08-01", dueDate: "2026-08-25",
  lines: [{ name: "관리비", amount: 30000 }, { name: "승강기유지비", amount: 5000 }], total: 35000,
  accounts: [{ bank: "국민", acct: "123", holder: "관리단" }], showCutoff: false, qrValue: "bill:1:2026-08-01",
};

describe("BillPreview", () => {
  it("항목·합계·계좌·QR·납기일 렌더", () => {
    render(<BillPreview docs={[doc]} issueType="a4" />);
    expect(screen.getByText("관리비")).toBeInTheDocument();
    expect(screen.getByText("35,000")).toBeInTheDocument();
    expect(screen.getByText(/국민.*123/)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-25/)).toBeInTheDocument();
    expect(screen.getByTestId("qr")).toHaveTextContent("bill:1:2026-08-01");
  });
  it("companyName 있으면 렌더, 없으면 생략", () => {
    const { rerender, queryByText } = render(<BillPreview docs={[doc]} issueType="a4" />);
    expect(queryByText("가나관리")).toBeNull();
    rerender(<BillPreview docs={[doc]} issueType="a4" companyName="가나관리" />);
    expect(queryByText("가나관리")).toBeInTheDocument();
  });
  it("showCutoff=true면 단전·단수 예고 문구", () => {
    render(<BillPreview docs={[{ ...doc, showCutoff: true }]} issueType="a4" />);
    expect(screen.getByText(/단전·단수 예고/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run BillPreview`
Expected: FAIL — `Cannot find module './BillPreview'`.

- [ ] **Step 3: 최소 구현** — `BillPreview.tsx`

```typescript
import React from "react";
import type { BillDocument } from "@/lib/billing/billDoc";
import { QRCode } from "./QRCode";

export interface BillPreviewProps {
  docs: BillDocument[];
  issueType: "giro" | "a4";
  companyName?: string;
}

export function BillPreview({ docs, issueType, companyName }: BillPreviewProps) {
  return (
    <div className="bill-print space-y-6">
      {docs.map((d) => (
        <article key={d.unitId} className={`bill-page border border-line p-6 ${issueType === "giro" ? "bill-giro" : "bill-a4"}`}>
          <header className="flex items-start justify-between">
            <div>
              {companyName && <div className="text-xs text-t3">{companyName}</div>}
              <h2 className="text-base font-bold">{d.title} 관리비 고지서</h2>
              <div className="text-xs text-t3">호실 {d.unitNo} · 부과월 {d.period.slice(0, 7)}{d.dueDate ? ` · 납기일 ${d.dueDate}` : ""}</div>
            </div>
            <QRCode value={d.qrValue} />
          </header>

          <table className="mt-4 w-full text-sm">
            <tbody>
              {d.lines.map((l) => (
                <tr key={l.name} className="border-b border-line/60"><td className="py-1">{l.name}</td><td className="py-1 text-right tabular-nums">{l.amount.toLocaleString("ko-KR")}</td></tr>
              ))}
              <tr className="font-bold"><td className="py-1">합계</td><td className="py-1 text-right tabular-nums">{d.total.toLocaleString("ko-KR")}</td></tr>
            </tbody>
          </table>

          {d.accounts.length > 0 && (
            <div className="mt-3 text-xs text-t2">
              입금계좌: {d.accounts.map((a) => `${a.bank} ${a.acct} (${a.holder})`).join(" · ")}
            </div>
          )}
          {d.showCutoff && <div className="mt-2 text-xs font-bold text-danger">※ 미납 시 단전·단수 예고 대상입니다.</div>}
          {companyName && <div className="mt-4 text-[10px] text-t4">{companyName}</div>}
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run BillPreview`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/bill/components/BillPreview.tsx" "app/(staff)/staff/bill/components/BillPreview.test.tsx"
git commit -m "feat(bill): 지로/A4 고지서 렌더(BillPreview)"
```

---

## Task 7: 인쇄 배선 + 발행유형·출력옵션 (page 통합)

**Files:**
- Modify: `app/(staff)/staff/bill/page.tsx` (발행유형·코드/이름·단수·납기일 옵션 + 미리보기 + [인쇄])
- Modify: `app/globals.css` (`@media print`)
- Test: `app/(staff)/staff/bill/page.test.tsx` (인쇄 트리거·옵션)

**Interfaces:**
- Consumes: `buildBillDocument`(`@/lib/billing/billDoc`), `BillPreview`(`./components/BillPreview`), `useSetupConfig`, `Button`.
- Produces: 선택 세대 → `docs` 배열 → `BillPreview`; [인쇄] → `window.print()`.

- [ ] **Step 1: 실패 테스트 작성** — `page.test.tsx`에 추가

```typescript
  it("발행유형·코드/이름 토글과 인쇄 버튼 노출, 인쇄 시 window.print 호출", () => {
    vi.mocked(useBilling).mockReturnValue({
      data: [{ unitId: 1, unitNo: "101", confirmedAt: "2026-08-13T00:00:00Z", isVacant: false, feeItemId: 10, feeItemName: "관리비", charged: true, amount: 30000, tenantName: "홍길동", moveInDate: "2026-07-01", dong: null, roomTypeLabel: null, occupancyId: 5, carryOver: false, dailyProration: false, rounding: "raw", isRequired: true, sortOrder: 0, confirmedByName: "관리자", totalAmount: 30000, billingNote: null, unitNotice: null, isDirty: false }],
      isLoading: false, error: null,
    } as never);
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<BillPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    fireEvent.click(screen.getByLabelText("전체 선택"));
    fireEvent.click(screen.getByRole("button", { name: "인쇄" }));
    expect(printSpy).toHaveBeenCalled();
  });
```

(상단 import에 `fireEvent` 포함 확인. `useSetupConfig`는 이미 mock됨.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run bill`
Expected: FAIL — "인쇄" 버튼 없음.

- [ ] **Step 3: 구현** — `page.tsx`에 발행유형·출력옵션 state, 미리보기 docs, [인쇄] 버튼 추가:

```typescript
  // 상태 추가
  const [issueType, setIssueType] = useState<"giro" | "a4">("a4");
  const [dueDate, setDueDate] = useState<string>("");
  const [cutoff, setCutoff] = useState<Set<number>>(new Set());
  const { data: setup } = useSetupConfig(me?.orgId);

  // 선택 세대 → 고지서 문서
  const docs = useMemo(
    () => confirmedUnits.filter((u) => selected.has(u.unitId)).map((u) =>
      buildBillDocument(u, columns, setup ?? null, period, { labelMode, dueDate: dueDate || undefined, showCutoff: cutoff.has(u.unitId) })),
    [confirmedUnits, selected, columns, setup, period, labelMode, dueDate, cutoff],
  );
```

상단 액션에 추가(발행유형·코드/이름·납기일·[인쇄]):

```tsx
<div className="flex items-end gap-2 no-print">
  <Select aria-label="발행유형" value={issueType} onChange={(e) => setIssueType(e.target.value as "giro" | "a4")}
    options={[{ value: "a4", label: "A4" }, { value: "giro", label: "지로" }]} />
  <Select aria-label="세대 표기" value={labelMode} onChange={(e) => setLabelMode(e.target.value as "code" | "name")}
    options={[{ value: "name", label: "이름 출력" }, { value: "code", label: "코드 출력" }]} />
  <label className="text-xs text-t2">납기일<input type="date" aria-label="납기일" className="ml-1 rounded border border-line px-2 py-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
  <Button onClick={() => window.print()} disabled={docs.length === 0}>인쇄</Button>
</div>
```

미리보기 렌더(테이블 아래):

```tsx
{docs.length > 0 && <BillPreview docs={docs} issueType={issueType} />}
```

import 추가: `import { buildBillDocument } from "@/lib/billing/billDoc";`, `import { BillPreview } from "./components/BillPreview";`, `import { useSetupConfig } from "@/hooks/reactquery/setupConfig";`, `import { Button } from "@/components/common";`.

- [ ] **Step 4: 인쇄 CSS** — `app/globals.css` 끝에 추가:

```css
@media print {
  /* 네비·상단 액션·목록 숨기고 고지서만 인쇄 */
  aside, header, nav, .no-print { display: none !important; }
  .bill-print { display: block !important; }
  .bill-page { break-after: page; border: none !important; padding: 0 !important; }
  .bill-page:last-child { break-after: auto; }
  @page { size: A4; margin: 12mm; }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run bill`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add "app/(staff)/staff/bill/page.tsx" "app/(staff)/staff/bill/page.test.tsx" app/globals.css
git commit -m "feat(bill): 발행유형·출력옵션·미리보기 + @media print 인쇄 배선"
```

- [ ] **Step 7: 그룹2 정적검사 + 전체 테스트**

Run: `npx tsc --noEmit` · `npm run lint` · `npx vitest run`
Expected: 에러 0, 전체 그린.

---

## 완료 기준 (Definition of Done)

- `/staff/bill` 진입 → 건물·월 선택 → 부과확정분 세대 목록 → 전체/개별 선택 → 미리보기 → [인쇄]로 지로/A4 고지서 인쇄.
- 코드/이름 표기·단수 표기·납기일 출력 옵션 동작(transient).
- 권한(`bill_publish`) 게이트·미확정/빈/에러/로딩 상태.
- 새 마이그레이션 0건. `tsc`·`lint`·`vitest` 전체 통과.
- **후속(별도 슬라이스)**: 회사명 소스 배선, 지로 정밀 좌표, 카톡·팩스·조정명세서·자동이체 세대 출력, 발송상태 저장.

## 실행 후 WBS

구현 커밋이 `/staff/bill`(서류 발행·출력 화면)을 건드리므로, 구현 착수 후 `wbs-commit-sync`로 **서류 발행·출력** 화면 dev를 `진행중`으로 반영(완료는 슬라이스 종료·사용자 확인 시).
