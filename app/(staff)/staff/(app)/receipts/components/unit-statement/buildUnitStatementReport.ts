import type { ReceiptStatementData } from "@/hooks/reactquery/receipts";
import type { UtilityType } from "@/hooks/reactquery/utilities";

export type UnitStatementScope = "all" | "unpaid";

export interface UnitStatementFeeColumn {
  key: string;
  labels: string[];
  feeItemIds: number[];
}

export interface UnitStatementRow {
  key: string;
  periodLabel: string;
  paymentDateLabel: string;
  charged: number | null;
  lateFee: number;
  paid: number;
  unpaid: number;
  utilityAmounts: Array<number | null>;
  meterReadings: Array<number | null>;
  unitPrice: number | null;
  feeValues: Array<Array<number | null>>;
}

export interface UnitStatementReportModel {
  unitLabel: string;
  feeColumns: UnitStatementFeeColumn[];
  rows: UnitStatementRow[];
  totals: { unpaid: number; lateFee: number; total: number };
}

const LATE_FEE_PATTERN = /연체|가산/;
const UTILITY_ITEM_PATTERN: Record<UtilityType, RegExp> = {
  electricity: /전기/,
  water: /수도/,
  gas: /가스/,
};
const FIGMA_FEE_COLUMN_COUNT = 7;

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

function utilityAmount(
  data: ReceiptStatementData | undefined,
  period: string,
  unitId: number,
  type: UtilityType,
) {
  const utility = (data?.utilities[type] ?? []).find(
    (row) => row.period === period && row.unitId === unitId,
  );
  if (utility) return utility.manualCharge ?? utility.automaticCharge;

  const document = (data?.documents ?? []).find(
    (row) => row.period === period && row.unitId === unitId,
  );
  const matches = (document?.items ?? []).filter(
    (item) => item.charged && UTILITY_ITEM_PATTERN[type].test(item.name),
  );
  return matches.length > 0 ? matches.reduce((sum, item) => sum + item.amount, 0) : null;
}

export function buildUnitStatementReport(
  data: ReceiptStatementData | undefined,
  unitId: number,
  periods: string[],
  utilityTypes: UtilityType[],
  scope: UnitStatementScope,
): UnitStatementReportModel {
  const periodSet = new Set(periods);
  const documents = (data?.documents ?? []).filter(
    (document) => document.unitId === unitId && periodSet.has(document.period),
  );

  const feeItems = new Map<number, string>();
  for (const document of documents) {
    for (const item of document.items) {
      if (
        item.charged &&
        !LATE_FEE_PATTERN.test(item.name)
      ) {
        feeItems.set(item.feeItemId, item.name);
      }
    }
  }
  const dynamicFeeColumns = chunk(
    [...feeItems.entries()].sort(([a], [b]) => a - b),
    3,
  ).map((group, index): UnitStatementFeeColumn => ({
    key: `fee-${index}`,
    labels: group.map(([, name]) => name),
    feeItemIds: group.map(([id]) => id),
  }));
  const feeColumns = Array.from(
    { length: Math.max(FIGMA_FEE_COLUMN_COUNT, dynamicFeeColumns.length) },
    (_, index): UnitStatementFeeColumn =>
      dynamicFeeColumns[index] ?? {
        key: `fee-placeholder-${index}`,
        labels: [],
        feeItemIds: [],
      },
  );

  const utilityTypeSet = new Set(utilityTypes);
  const rows = periods
    .map((period): UnitStatementRow | null => {
      const paymentRow = (data?.paymentRows ?? []).find(
        (row) => row.period === period && row.unitId === unitId,
      );
      const document = documents.find((row) => row.period === period);
      if (!paymentRow && !document) return null;

      const payments = (data?.payments ?? [])
        .filter(
          (payment) =>
            payment.period === period &&
            payment.unitId === unitId &&
            payment.status === "active",
        )
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
      const lateFee = (document?.items ?? [])
        .filter((item) => item.charged && LATE_FEE_PATTERN.test(item.name))
        .reduce((sum, item) => sum + item.amount, 0);
      const primaryUtility = (utilityTypes.length > 0 ? utilityTypes : ["electricity" as const])
        .map((type) =>
          (data?.utilities[type] ?? []).find(
            (row) => row.period === period && row.unitId === unitId,
          ),
        )
        .find(Boolean);
      const valuesByItem = new Map(
        (document?.items ?? [])
          .filter((item) => item.charged)
          .map((item) => [item.feeItemId, item.amount]),
      );

      return {
        key: period,
        periodLabel: period.slice(0, 7),
        paymentDateLabel: payments[0]?.paidAt.slice(0, 10).replaceAll("-", ".") ?? "",
        charged: paymentRow?.charged ?? document?.totalAmount ?? null,
        lateFee,
        paid: paymentRow?.paid ?? payments.reduce((sum, payment) => sum + payment.amount, 0),
        unpaid: Math.max(paymentRow?.unpaid ?? 0, 0),
        utilityAmounts: (["electricity", "water", "gas"] as UtilityType[]).map((type) =>
          utilityTypeSet.has(type) ? utilityAmount(data, period, unitId, type) : null,
        ),
        meterReadings: [
          primaryUtility?.currentReading ?? null,
          primaryUtility?.previousReading ?? null,
          primaryUtility?.usage ?? null,
        ],
        unitPrice: primaryUtility?.resolvedUnitPrice ?? primaryUtility?.unitPrice ?? null,
        feeValues: feeColumns.map((column) =>
          column.feeItemIds.map((feeItemId) => valuesByItem.get(feeItemId) ?? null),
        ),
      };
    })
    .filter((row): row is UnitStatementRow => row !== null)
    .filter((row) => scope === "all" || row.unpaid > 0)
    .sort((a, b) => b.key.localeCompare(a.key));

  const reference =
    (data?.paymentRows ?? []).find((row) => row.unitId === unitId) ??
    (data?.documents ?? []).find((row) => row.unitId === unitId);
  const normalizedUnitNo = reference?.unitNo.endsWith("호")
    ? reference.unitNo
    : reference
      ? `${reference.unitNo}호`
      : "";
  const unitLabel = reference
    ? `${reference.dong ? `${reference.dong} ` : ""}${normalizedUnitNo}`
    : "선택 호실";
  const unpaid = rows.reduce((sum, row) => sum + row.unpaid, 0);
  const lateFee = rows.reduce((sum, row) => sum + row.lateFee, 0);

  return {
    unitLabel,
    feeColumns,
    rows,
    totals: { unpaid, lateFee, total: unpaid + lateFee },
  };
}
