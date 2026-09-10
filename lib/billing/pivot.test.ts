import { describe, it, expect } from "vitest";
import { pivotBillingRows, type BillingFlatRow } from "./pivot";

const base: Omit<BillingFlatRow, "feeItemId" | "feeItemName" | "sortOrder" | "charged" | "amount"> = {
  unitId: 1, unitNo: "101", dong: null, roomTypeLabel: "원룸",
  areaPyeong: null,
  occupancyId: 5, tenantName: "홍길동", moveInDate: "2026-08-01", isVacant: false,
  carryOver: false, dailyProration: false, rounding: "round", isRequired: true,
  confirmedAt: null, confirmedByName: null, totalAmount: null, billingNote: null, unitNotice: null, isDirty: false,
};

describe("billing/pivot", () => {
  it("항목을 컬럼으로, 세대를 행으로 피벗", () => {
    const rows: BillingFlatRow[] = [
      { ...base, feeItemId: 10, feeItemName: "관리비", sortOrder: 0, charged: true, amount: 30000 },
      { ...base, feeItemId: 11, feeItemName: "수도", sortOrder: 1, charged: true, amount: 5000 },
    ];
    const { units, columns } = pivotBillingRows(rows);
    expect(columns.map((c) => c.name)).toEqual(["관리비", "수도"]);
    expect(units).toHaveLength(1);
    expect(units[0].charges[10]).toEqual({ charged: true, amount: 30000 });
    expect(units[0].charges[11]).toEqual({ charged: true, amount: 5000 });
  });
  it("컬럼은 sortOrder로 유일·정렬, 세대는 unitNo 순", () => {
    const rows: BillingFlatRow[] = [
      { ...base, unitId: 2, unitNo: "102", feeItemId: 11, feeItemName: "수도", sortOrder: 1, charged: true, amount: 1 },
      { ...base, unitId: 1, unitNo: "101", feeItemId: 10, feeItemName: "관리비", sortOrder: 0, charged: true, amount: 2 },
      { ...base, unitId: 1, unitNo: "101", feeItemId: 11, feeItemName: "수도", sortOrder: 1, charged: true, amount: 3 },
      { ...base, unitId: 2, unitNo: "102", feeItemId: 10, feeItemName: "관리비", sortOrder: 0, charged: true, amount: 4 },
    ];
    const { units, columns } = pivotBillingRows(rows);
    expect(columns.map((c) => c.feeItemId)).toEqual([10, 11]);
    expect(units.map((u) => u.unitNo)).toEqual(["101", "102"]);
  });
});
