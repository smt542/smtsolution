import type {
  ReceiptStatementData,
  ReceiptStatementPaymentRow,
} from "@/hooks/reactquery/receipts";
import { LATE_FEE_PATTERN, orderFeeItems } from "../chargeReport/feeItemOrder";
import {
  type CellLine,
  type MonthlyColumn,
  type MonthlyReportModel,
  type MonthlyReportRow,
  type MonthlySummary,
  formatCollectionRate,
  METRIC_COLUMNS,
  moneyLine,
} from "./monthlyChargeData";

const FIGMA_FEE_COLUMN_COUNT = 7;
const pad = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM'에서 delta 개월 이동한 'YYYY-MM'. */
export function shiftMonth(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** 시작월~종료월(포함) 사이 모든 'YYYY-MM-01' 기간. */
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

interface MonthAgg {
  period: string;
  households: number;
  charged: number;
  paid: number;
  fee: number;
  lateFee: number;
  netPaid: number;
  unpaid: number;
  /** 납기내금액 = 당월분 + 연체료. */
  dueAmount: number;
  rate: number | null;
  feeItemAmounts: Record<number, number>;
}

interface FeeItemRef {
  feeItemId: number;
  name: string;
}

export interface BuildMonthlyOptions {
  paymentStartDate?: string | null;
  paymentEndDate?: string | null;
  configuredFeeItems?: Array<{ id: number; name: string; sortOrder: number }>;
  /**
   * 세대×월분 연체료(연체 요율표 + 납기후 가산, 수납 이력 표와 같은 계산).
   * 연체료는 부과 항목이 아니라 미납원금 기준 계산값이라 명세 항목에서는 구할 수 없다.
   */
  lateFeeOf?: (row: ReceiptStatementPaymentRow) => number;
}

function inDateRange(dateIso: string, start?: string | null, end?: string | null) {
  const day = dateIso.slice(0, 10);
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

function aggregate(
  data: ReceiptStatementData | undefined,
  periods: string[],
  options: BuildMonthlyOptions,
): { months: MonthAgg[]; feeItems: FeeItemRef[] } {
  const { paymentStartDate, paymentEndDate } = options;
  const dateFilterActive = Boolean(paymentStartDate || paymentEndDate);

  const feeItemOrder: FeeItemRef[] = [];
  const feeItemSeen = new Set<number>();

  const months = periods.map((period): MonthAgg => {
    const rows = (data?.paymentRows ?? []).filter((row) => row.period === period);
    const docs = (data?.documents ?? []).filter((doc) => doc.period === period);
    const payments = (data?.payments ?? []).filter(
      (payment) => payment.period === period && payment.status === "active",
    );

    const charged = rows.reduce((total, row) => total + (row.charged ?? 0), 0);
    const households = rows.filter((row) => (row.charged ?? 0) > 0).length;

    const scopedPayments = dateFilterActive
      ? payments.filter((payment) => inDateRange(payment.paidAt, paymentStartDate, paymentEndDate))
      : payments;
    const fee = scopedPayments.reduce((total, payment) => total + payment.fee, 0);
    const paid = dateFilterActive
      ? scopedPayments.reduce((total, payment) => total + payment.amount, 0)
      : rows.reduce((total, row) => total + row.paid, 0);

    const lateFee = options.lateFeeOf
      ? rows.reduce((total, row) => total + options.lateFeeOf!(row), 0)
      : 0;
    // 미납액 = 납기내금액 − 당월수납액(연체료 포함). 수납일 필터 중엔 필터된 수납액 기준.
    const dueAmount = charged + lateFee;
    const unpaid = dateFilterActive
      ? dueAmount - paid
      : rows.reduce((total, row) => total + (row.unpaid ?? 0), 0) + lateFee;

    const feeItemAmounts: Record<number, number> = {};
    for (const doc of docs) {
      for (const item of doc.items) {
        if (!item.charged) continue;
        // 연체 항목은 관리비 항목 열에서 뺀다(연체료는 위에서 계산).
        if (LATE_FEE_PATTERN.test(item.name)) continue;
        feeItemAmounts[item.feeItemId] = (feeItemAmounts[item.feeItemId] ?? 0) + item.amount;
        if (!feeItemSeen.has(item.feeItemId)) {
          feeItemSeen.add(item.feeItemId);
          feeItemOrder.push({ feeItemId: item.feeItemId, name: item.name });
        }
      }
    }

    return {
      period,
      households,
      charged,
      paid,
      fee,
      lateFee,
      // 실수납액 = 당월수납액 + 연체료 − 수수료
      netPaid: paid + lateFee - fee,
      unpaid,
      dueAmount,
      rate: charged > 0 ? (paid / charged) * 100 : null,
      feeItemAmounts,
    };
  }).sort((a, b) => b.period.localeCompare(a.period));

  // 열은 항목등록 관리의 현재 항목만 쓴다(삭제된 과거 항목이 열로 되살아나지 않게).
  // 설정 조회 전/실패 시에만 고지서 스냅샷 항목으로 대체한다.
  const hasConfigured = (options.configuredFeeItems?.length ?? 0) > 0;
  const feeItems = orderFeeItems(options.configuredFeeItems, hasConfigured ? [] : feeItemOrder);
  return { months, feeItems };
}

const periodLabel = (period: string) => `${period.slice(0, 4)} ${period.slice(5, 7)}`;

/** 수수료는 차감 항목이라 음수(빨강)로 표기한다. 0은 그대로 0. */
function feeLine(fee: number): CellLine {
  return moneyLine(fee === 0 ? 0 : -fee);
}

/** 메트릭 4열(ym/current/paid/unpaid)의 셀 라인. */
function metricCells(month: MonthAgg | null, isTotal: boolean): CellLine[][] {
  if (isTotal || month === null) return [];
  const currentLines: CellLine[] = [
    moneyLine(month.charged),
    month.rate === null
      ? { text: "" }
      : { text: formatCollectionRate(month.rate), tone: "red" },
    feeLine(month.fee),
  ];

  return [
    [{ text: periodLabel(month.period) }, { text: String(month.households) }],
    currentLines,
    [moneyLine(month.paid), moneyLine(month.lateFee), moneyLine(month.netPaid)],
    [moneyLine(month.unpaid), moneyLine(month.lateFee), moneyLine(month.dueAmount)],
  ];
}

function feeCells(month: MonthAgg, feeGroups: FeeItemRef[][]): CellLine[][] {
  return feeGroups.map((group) =>
    group.map((item) => moneyLine(month.feeItemAmounts[item.feeItemId] ?? 0)),
  );
}

function sum(months: MonthAgg[], pick: (m: MonthAgg) => number): number {
  return months.reduce((total, month) => total + pick(month), 0);
}

/** 명세 원자료 → "월별 부과금액" 표시 모델(고정 메트릭 열 + 동적 항목 열). */
export function buildMonthlyReport(
  data: ReceiptStatementData | undefined,
  periods: string[],
  summaryMeta: { periodRange: string; paymentDate: string },
  options: BuildMonthlyOptions = {},
): MonthlyReportModel {
  const { months, feeItems } = aggregate(data, periods, options);
  const dynamicFeeGroups = chunk(feeItems, 3);
  const feeGroups = Array.from(
    { length: Math.max(FIGMA_FEE_COLUMN_COUNT, dynamicFeeGroups.length) },
    (_, index) => dynamicFeeGroups[index] ?? [],
  );

  const feeColumns: MonthlyColumn[] = feeGroups.map((group, index) => ({
    key: `fee-${index}`,
    minWidth: 96,
    align: "right",
    header: [group[0]?.name, group[1]?.name, group[2]?.name],
  }));
  const columns = [...METRIC_COLUMNS, ...feeColumns];

  const rows: MonthlyReportRow[] = months.map((month) => ({
    key: month.period,
    cells: [...metricCells(month, false), ...feeCells(month, feeGroups)],
  }));

  // 총계 행: current 열은 수납율 라인 없음.
  const totalCharged = sum(months, (m) => m.charged);
  const totalPaid = sum(months, (m) => m.paid);
  const totalFee = sum(months, (m) => m.fee);
  const totalLateFee = sum(months, (m) => m.lateFee);
  const totalNetPaid = sum(months, (m) => m.netPaid);
  const totalUnpaid = sum(months, (m) => m.unpaid);
  const totalDueAmount = sum(months, (m) => m.dueAmount);
  const totalFeeItemAmounts: Record<number, number> = {};
  for (const month of months) {
    for (const [id, amount] of Object.entries(month.feeItemAmounts)) {
      const key = Number(id);
      totalFeeItemAmounts[key] = (totalFeeItemAmounts[key] ?? 0) + amount;
    }
  }

  const total: MonthlyReportRow = {
    key: "총계",
    cells: [
      [{ text: "총 계" }],
      [
        moneyLine(totalCharged),
        { text: "" },
        feeLine(totalFee),
      ],
      [moneyLine(totalPaid), moneyLine(totalLateFee), moneyLine(totalNetPaid)],
      [moneyLine(totalUnpaid), moneyLine(totalLateFee), moneyLine(totalDueAmount)],
      ...feeGroups.map((group) =>
        group.map((item) => moneyLine(totalFeeItemAmounts[item.feeItemId] ?? 0)),
      ),
    ],
  };

  const summary: MonthlySummary = {
    periodRange: summaryMeta.periodRange,
    paymentDate: summaryMeta.paymentDate,
    totalCurrentPaid: totalPaid,
    totalLateFee,
    totalFee: totalFee === 0 ? 0 : -totalFee,
    totalPaid: totalNetPaid,
  };

  return { columns, rows, total, summary };
}
