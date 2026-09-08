import { describe, expect, it } from "vitest";
import type { ReceiptStatementData } from "@/hooks/reactquery/receipts";
import { buildVillaReceiptReport } from "./buildVillaReceiptReport";

const data: ReceiptStatementData = {
  paymentRows: [
    {
      period: "2026-08-01",
      unitId: 101,
      unitNo: "101",
      dong: null,
      occupancyId: 1,
      tenantName: "김관리",
      isVacant: false,
      isAutoDebit: false,
      dueDate: "2026-08-31",
      payerNo: null,
      payerName: null,
      charged: 32_500,
      paid: 32_500,
      unpaid: 0,
      payStatus: "paid",
    },
    {
      period: "2026-08-01",
      unitId: 102,
      unitNo: "102",
      dong: null,
      occupancyId: 2,
      tenantName: "박관리",
      isVacant: false,
      isAutoDebit: false,
      dueDate: "2026-08-31",
      payerNo: null,
      payerName: null,
      charged: 33_100,
      paid: 10_000,
      unpaid: 23_100,
      payStatus: "partial",
    },
  ],
  payments: [
    {
      id: 1,
      unitId: 101,
      period: "2026-08-01",
      amount: 32_500,
      fee: 0,
      method: "transfer",
      kind: "full",
      memo: null,
      paidAt: "2026-08-28",
      status: "active",
      createdAt: "2026-08-28T00:00:00Z",
    },
    {
      id: 2,
      unitId: 102,
      period: "2026-08-01",
      amount: 10_000,
      fee: 0,
      method: "auto_debit",
      kind: "partial",
      memo: "일부 수납",
      paidAt: "2026-08-17",
      status: "active",
      createdAt: "2026-08-17T00:00:00Z",
    },
  ],
  documents: [],
  utilities: { electricity: [], water: [], gas: [] },
};

describe("buildVillaReceiptReport", () => {
  it("builds one row per household/month with transaction metadata and totals", () => {
    const report = buildVillaReceiptReport(data, ["2026-08-01"], "all");

    expect(report.rows).toHaveLength(2);
    expect(report.rows[0]).toMatchObject({
      unitLabel: "101",
      periodLabel: "2026-08",
      charged: 32_500,
      paid: 32_500,
      paidAtLabel: "2026/08/28",
      methodLabel: "무통장입금",
      kindLabel: "일반",
    });
    expect(report.rows[1]).toMatchObject({
      unitLabel: "102",
      methodLabel: "자동이체",
      kindLabel: "부분",
      memo: "일부 수납",
    });
    expect(report.totals).toEqual({ charged: 65_600, paid: 42_500 });
  });

  it("keeps only paid households for the paid scope", () => {
    const report = buildVillaReceiptReport(data, ["2026-08-01"], "paid");

    expect(report.rows.map((row) => row.unitLabel)).toEqual(["101", "102"]);
  });
});
