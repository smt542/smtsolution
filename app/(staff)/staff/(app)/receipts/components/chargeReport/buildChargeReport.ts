import type { ReceiptStatementData } from "@/hooks/reactquery/receipts";
import { LATE_FEE_PATTERN, orderFeeItems } from "./feeItemOrder";

const FIGMA_FEE_COLUMN_COUNT = 7;

export interface ChargeReportFeeItem {
  feeItemId: number;
  name: string;
}

export interface ChargeReportMonthRow {
  period: string; // 'YYYY-MM-01'
  periodLabel: string; // '2026 08'
  charged: number; // 당월분(부과)
  paid: number; // 당월수납액
  fee: number; // 수수료
  lateFee: number; // 연체료
  netPaid: number; // 실수납액 = 수납액 − 수수료
  rate: number | null; // 수납율(%) = 수납액 / 부과액
  feeItemAmounts: Record<number, number>; // feeItemId → 부과금액
}

export interface ChargeReportTotals {
  charged: number;
  paid: number;
  fee: number;
  lateFee: number;
  netPaid: number;
  rate: number | null;
  feeItemAmounts: Record<number, number>;
}

export interface ChargeReportModel {
  months: ChargeReportMonthRow[];
  feeItems: ChargeReportFeeItem[]; // 정렬된 전체 관리비 항목(연체료 제외)
  feeItemColumns: ChargeReportFeeItem[][]; // 3개씩 묶은 컬럼(피그마 밀도 재현)
  totals: ChargeReportTotals;
}

export interface ChargeReportOptions {
  paymentStartDate?: string | null; // 수납일 필터 시작('YYYY-MM-DD')
  paymentEndDate?: string | null; // 수납일 필터 종료
  configuredFeeItems?: Array<{ id: number; name: string; sortOrder: number }>;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM' 기준으로 delta 개월 이동한 'YYYY-MM' 반환. */
export function shiftMonth(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** 시작월~종료월(포함) 사이의 모든 'YYYY-MM-01' 기간 배열. */
export function periodsBetween(startMonth: string, endMonth: string): string[] {
  const toIndex = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    if (!year || !month) return Number.NaN;
    return year * 12 + (month - 1);
  };
  const start = toIndex(startMonth);
  const end = toIndex(endMonth);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const index = start + offset;
    return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}-01`;
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

function inDateRange(dateIso: string, start?: string | null, end?: string | null) {
  const day = dateIso.slice(0, 10);
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

function sumBy(rows: ChargeReportMonthRow[], key: keyof ChargeReportMonthRow): number {
  return rows.reduce((total, row) => total + (row[key] as number), 0);
}

/**
 * 명세 원자료(useReceiptStatementData)를 건물 단위 월별 부과·수납 리포트 모델로 집계한다.
 * - 당월분/당월수납액: paymentRows(세대별 기간 집계)를 합산
 * - 수수료: 활성 payments.fee 합산(수납일 필터 시 해당 기간 payments만)
 * - 연체료: documents 항목 중 연체·가산 항목 합산
 * - 관리비 항목별 부과: documents.items(charged) 를 feeItemId 로 합산
 */
export function buildChargeReport(
  data: ReceiptStatementData | undefined,
  periods: string[],
  options: ChargeReportOptions = {},
): ChargeReportModel {
  const { paymentStartDate, paymentEndDate } = options;
  const dateFilterActive = Boolean(paymentStartDate || paymentEndDate);

  const feeItemOrder: ChargeReportFeeItem[] = [];
  const feeItemSeen = new Set<number>();

  const months = periods.map((period): ChargeReportMonthRow => {
    const rows = (data?.paymentRows ?? []).filter((row) => row.period === period);
    const docs = (data?.documents ?? []).filter((doc) => doc.period === period);
    const payments = (data?.payments ?? []).filter(
      (payment) => payment.period === period && payment.status === "active",
    );

    const charged = rows.reduce((total, row) => total + (row.charged ?? 0), 0);

    const scopedPayments = dateFilterActive
      ? payments.filter((payment) => inDateRange(payment.paidAt, paymentStartDate, paymentEndDate))
      : payments;
    const fee = scopedPayments.reduce((total, payment) => total + payment.fee, 0);
    const paid = dateFilterActive
      ? scopedPayments.reduce((total, payment) => total + payment.amount, 0)
      : rows.reduce((total, row) => total + row.paid, 0);

    let lateFee = 0;
    const feeItemAmounts: Record<number, number> = {};
    for (const doc of docs) {
      for (const item of doc.items) {
        if (!item.charged) continue;
        if (LATE_FEE_PATTERN.test(item.name)) {
          lateFee += item.amount;
          continue;
        }
        feeItemAmounts[item.feeItemId] = (feeItemAmounts[item.feeItemId] ?? 0) + item.amount;
        if (!feeItemSeen.has(item.feeItemId)) {
          feeItemSeen.add(item.feeItemId);
          feeItemOrder.push({ feeItemId: item.feeItemId, name: item.name });
        }
      }
    }

    const netPaid = paid - fee;
    const rate = charged > 0 ? (paid / charged) * 100 : null;

    return {
      period,
      periodLabel: `${period.slice(0, 4)} ${period.slice(5, 7)}`,
      charged,
      paid,
      fee,
      lateFee,
      netPaid,
      rate,
      feeItemAmounts,
    };
  }).sort((a, b) => b.period.localeCompare(a.period));

  const feeItems = orderFeeItems(options.configuredFeeItems, feeItemOrder);

  const totalCharged = sumBy(months, "charged");
  const totalPaid = sumBy(months, "paid");
  const totalFeeItemAmounts: Record<number, number> = {};
  for (const month of months) {
    for (const [id, amount] of Object.entries(month.feeItemAmounts)) {
      const key = Number(id);
      totalFeeItemAmounts[key] = (totalFeeItemAmounts[key] ?? 0) + amount;
    }
  }

  const totals: ChargeReportTotals = {
    charged: totalCharged,
    paid: totalPaid,
    fee: sumBy(months, "fee"),
    lateFee: sumBy(months, "lateFee"),
    netPaid: sumBy(months, "netPaid"),
    rate: totalCharged > 0 ? (totalPaid / totalCharged) * 100 : null,
    feeItemAmounts: totalFeeItemAmounts,
  };

  const dynamicFeeItemColumns = chunk(feeItems, 3);
  const feeItemColumns = Array.from(
    { length: Math.max(FIGMA_FEE_COLUMN_COUNT, dynamicFeeItemColumns.length) },
    (_, index) => dynamicFeeItemColumns[index] ?? [],
  );

  return { months, feeItems, feeItemColumns, totals };
}
