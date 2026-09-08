import type {
  ReceiptStatementData,
  ReceiptStatementPayment,
} from "@/hooks/reactquery/receipts";

export type VillaReceiptScope = "all" | "paid";

export interface VillaReceiptReportRow {
  key: string;
  unitLabel: string;
  periodLabel: string;
  charged: number | null;
  paid: number;
  paidAtLabel: string;
  methodLabel: string;
  kindLabel: string;
  memo: string;
}

export interface VillaReceiptReportModel {
  rows: VillaReceiptReportRow[];
  totals: { charged: number; paid: number };
}

const METHOD_LABEL: Record<ReceiptStatementPayment["method"], string> = {
  cash: "현금",
  transfer: "무통장입금",
  auto_debit: "자동이체",
  giro: "지로",
  card: "카드",
  other: "기타",
};

const KIND_LABEL: Record<ReceiptStatementPayment["kind"], string> = {
  full: "일반",
  principal: "원금",
  partial: "부분",
};

const paymentKey = (period: string, unitId: number) => `${period}:${unitId}`;

function latestPayment(payments: ReceiptStatementPayment[]) {
  return [...payments].sort((a, b) => {
    const byPaidAt = b.paidAt.localeCompare(a.paidAt);
    return byPaidAt !== 0 ? byPaidAt : b.id - a.id;
  })[0];
}

export function buildVillaReceiptReport(
  data: ReceiptStatementData | undefined,
  periods: string[],
  scope: VillaReceiptScope,
): VillaReceiptReportModel {
  const periodSet = new Set(periods);
  const paymentsByHousehold = new Map<string, ReceiptStatementPayment[]>();

  for (const payment of data?.payments ?? []) {
    if (payment.status !== "active" || !periodSet.has(payment.period)) continue;
    const key = paymentKey(payment.period, payment.unitId);
    paymentsByHousehold.set(key, [...(paymentsByHousehold.get(key) ?? []), payment]);
  }

  const rows = (data?.paymentRows ?? [])
    .filter((row) => periodSet.has(row.period))
    .filter((row) => scope === "all" || row.paid > 0)
    .map((row): VillaReceiptReportRow => {
      const payment = latestPayment(paymentsByHousehold.get(paymentKey(row.period, row.unitId)) ?? []);
      return {
        key: paymentKey(row.period, row.unitId),
        unitLabel: row.dong ? `${row.dong}-${row.unitNo}` : row.unitNo,
        periodLabel: row.period.slice(0, 7),
        charged: row.charged,
        paid: row.paid,
        paidAtLabel: payment?.paidAt.slice(0, 10).replaceAll("-", "/") ?? "",
        methodLabel: payment ? METHOD_LABEL[payment.method] : "",
        kindLabel: payment ? KIND_LABEL[payment.kind] : "",
        memo: payment?.memo ?? "",
      };
    })
    .sort((a, b) => {
      const byPeriod = b.periodLabel.localeCompare(a.periodLabel);
      return byPeriod !== 0
        ? byPeriod
        : a.unitLabel.localeCompare(b.unitLabel, "ko-KR", { numeric: true });
    });

  return {
    rows,
    totals: {
      charged: rows.reduce((sum, row) => sum + (row.charged ?? 0), 0),
      paid: rows.reduce((sum, row) => sum + row.paid, 0),
    },
  };
}
