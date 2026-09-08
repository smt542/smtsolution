import { describe, expect, it } from "vitest";
import type { ReceiptStatementData } from "@/hooks/reactquery/receipts";
import { buildUnitStatementReport } from "./buildUnitStatementReport";

const data: ReceiptStatementData = {
  paymentRows: [
    {
      period: "2026-07-01",
      unitId: 101,
      unitNo: "101호",
      dong: null,
      occupancyId: 1,
      tenantName: "김관리",
      isVacant: false,
      isAutoDebit: false,
      dueDate: "2026-07-31",
      payerNo: null,
      payerName: null,
      charged: 38_940,
      paid: 30_000,
      unpaid: 8_940,
      payStatus: "partial",
    },
  ],
  payments: [
    {
      id: 1,
      unitId: 101,
      period: "2026-07-01",
      amount: 30_000,
      fee: 0,
      method: "transfer",
      kind: "partial",
      memo: null,
      paidAt: "2026-07-22",
      status: "active",
      createdAt: "2026-07-22T00:00:00Z",
    },
  ],
  documents: [
    {
      period: "2026-07-01",
      unitId: 101,
      unitNo: "101호",
      dong: null,
      tenantName: "김관리",
      totalAmount: 38_940,
      autoDebit: false,
      items: [
        { feeItemId: 1, name: "일반관리비", charged: true, amount: 30_000 },
        { feeItemId: 2, name: "청소비", charged: true, amount: 2_040 },
        { feeItemId: 3, name: "연체료", charged: true, amount: 1_000 },
        { feeItemId: 4, name: "전기료", charged: true, amount: 6_900 },
      ],
      billingNote: null,
      unitNotice: null,
    },
  ],
  utilities: {
    electricity: [
      {
        period: "2026-07-01",
        unitId: 101,
        unitNo: "101",
        dong: null,
        occupancyId: 1,
        tenantName: "김관리",
        occupancyStatus: "occupied",
        moveInDate: null,
        customerNumber: null,
        meterNumber: null,
        previousReading: 382,
        currentReading: 387,
        usage: 5,
        unitPrice: 1_380,
        resolvedUnitPrice: 1_380,
        automaticCharge: 6_900,
        manualCharge: null,
        note: null,
        processedAt: null,
        discountType: null,
        discountAmount: null,
      },
    ],
    water: [],
    gas: [],
  },
};

describe("buildUnitStatementReport", () => {
  it("maps statement, utility, fee-item, and footer totals into the Figma table model", () => {
    const report = buildUnitStatementReport(
      data,
      101,
      ["2026-07-01"],
      ["electricity", "water", "gas"],
      "all",
    );

    expect(report.unitLabel).toBe("101호");
    expect(report.feeColumns).toHaveLength(7);
    expect(report.feeColumns[0]?.labels).toEqual(["일반관리비", "청소비", "전기료"]);
    expect(report.rows[0]).toMatchObject({
      periodLabel: "2026-07",
      paymentDateLabel: "2026.07.22",
      charged: 38_940,
      lateFee: 1_000,
      paid: 30_000,
      utilityAmounts: [6_900, null, null],
      meterReadings: [387, 382, 5],
      unitPrice: 1_380,
      feeValues: [[30_000, 2_040, 6_900], [], [], [], [], [], []],
    });
    expect(report.totals).toEqual({ unpaid: 8_940, lateFee: 1_000, total: 9_940 });
  });
});
