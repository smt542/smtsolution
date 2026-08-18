import { describe, expect, it } from "vitest";
import { combineReceiptBuildingStatuses } from "./queries";

describe("combineReceiptBuildingStatuses", () => {
  it("payment read에 건물·전화번호·납기 fallback과 항목별 합계를 결합한다", () => {
    const result = combineReceiptBuildingStatuses([
      {
        building: { id: 2, name: "그린빌라" },
        paymentRows: [
          {
            unitId: 21,
            unitNo: "101호",
            dong: "A동",
            occupancyId: 31,
            tenantName: "김입주",
            isVacant: false,
            isAutoDebit: false,
            dueDate: null,
            payerNo: null,
            payerName: null,
            charged: 120_000,
            paid: 50_000,
            unpaid: 70_000,
            payStatus: "partial",
          },
        ],
        billingRows: [
          { feeItemId: 1, feeItemName: "일반관리비", charged: true, amount: 70_000 },
          { feeItemId: 1, feeItemName: "일반관리비", charged: true, amount: 50_000 },
          { feeItemId: 2, feeItemName: "수도료", charged: false, amount: 10_000 },
        ],
        periodSetting: {
          buildingId: 2,
          period: "2026-08-01",
          chargeStartDate: "2026-07-16",
          chargeEndDate: "2026-08-15",
          dueDate: "2026-08-25",
          isSaved: true,
        },
        overdueHouseholds: [
          {
            unitId: 21,
            occupancyId: 31,
            buildingId: 2,
            buildingName: "그린빌라",
            unitNo: "101호",
            tenantName: "김입주",
            phone: "010-1111-2222",
            status: "occupied",
            overdueMonths: 1,
            overdueAmount: 70_000,
            lastPaymentDate: "2026-08-10",
            billingAvailable: true,
          },
        ],
      } as Parameters<typeof combineReceiptBuildingStatuses>[0][number],
    ]);

    expect(result.rows[0]).toEqual(expect.objectContaining({
      buildingId: 2,
      buildingName: "그린빌라",
      dueDate: "2026-08-25",
      phone: "010-1111-2222",
      overdueMonths: 1,
    }));
    expect(result.feeItems).toEqual([
      expect.objectContaining({ feeItemName: "일반관리비", amount: 120_000 }),
    ]);
  });
});
