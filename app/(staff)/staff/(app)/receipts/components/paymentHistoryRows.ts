import type { DepositType, PaymentKind, PaymentMethod, UnitPayment } from "@/hooks/reactquery/payments";
import {
  type ReceiptLateFeeSplit,
  type ReceiptPaymentRow,
  type ReceiptStatementPaymentRow,
} from "@/hooks/reactquery/receipts";
import {
  computeLateFeeForPeriod,
  type LateFeeSettings,
  type RateTier,
} from "@/lib/billing/lateFee";
import type { Period } from "@/lib/billing/period";

export interface PaymentFields {
  amount: string;
  fee: string;
  method: PaymentMethod;
  kind: PaymentKind;
  /** 입금 은행(수납): 무통장입금·지로입금, 선택 안 함 = "" */
  depositType: DepositType | "";
  paidAt: string;
  memo: string;
}

export type DraftSource = "none" | "added" | "split" | "summary";
export type HistoryPayment = UnitPayment & { period?: string };

export interface HistoryDisplayRow {
  key: string;
  rowPeriod: string;
  rowSummary: ReceiptStatementPaymentRow | ReceiptPaymentRow | undefined;
  dueDate: string | null;
  payment: HistoryPayment | null;
  fields: PaymentFields;
  originalFields: PaymentFields | null;
  /** 아직 내지 않은 연체료(미납 원금 기준). 하단 미납 합계·수납 버튼 잔액에 쓴다. */
  lateFee: number;
  /** 이미 수납된 연체료 = 그 달 수납 합계가 당월계를 넘은 금액. 연체 열·영수증 표시에만 더한다. */
  collectedLateFee: number;
  draftSource: DraftSource;
  /** 연체료 이전(수.연) 행. 저장 전 초안(draftSource "split")과 저장된 미수금(split) 모두 true. */
  lateOnly: boolean;
  /** 저장된 수.연 미수금(0292). 이 행에서 받은 수납은 이 미수금에 연결된다. */
  split?: ReceiptLateFeeSplit;
  cancelRequested: boolean;
  cancelCompleted: boolean;
  /** 삭제(취소)된 수납을 저장 시 되살리도록 예약 */
  restoreRequested: boolean;
  saved: boolean;
  /**
   * 「추가」 행에서 직접 입력하는 그 달 당월계·연체(실제 부과·연체로 반영, 0291).
   * 처음 값(initial)과 달라진 칸만 저장한다 — 손대지 않은 자동 연체료가 수동 값으로 굳지 않게.
   */
  billDraft?: { charged: string; lateFee: string; chargedInitial: string; lateFeeInitial: string };
}

export function todayInput(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatInputNumber(value: number): string {
  return value > 0 ? value.toLocaleString("ko-KR") : "0";
}

export function parseInputNumber(value: string): number | null {
  const raw = value.replace(/[^0-9]/g, "");
  if (!raw) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) ? number : null;
}

export function normalizeAmount(value: string): number {
  return parseInputNumber(value) ?? 0;
}

export function emptyFields(method: PaymentMethod = "transfer", kind: PaymentKind = "full"): PaymentFields {
  return { amount: "", fee: "0", method, kind, depositType: "", paidAt: "", memo: "" };
}

function paymentFields(payment: HistoryPayment): PaymentFields {
  return {
    amount: formatInputNumber(payment.amount),
    fee: formatInputNumber(payment.fee),
    method: payment.method,
    kind: payment.kind,
    depositType: payment.depositType ?? "",
    paidAt: payment.paidAt.slice(0, 10),
    memo: payment.memo ?? "",
  };
}

export function cloneRow(row: HistoryDisplayRow): HistoryDisplayRow {
  return {
    ...row,
    fields: { ...row.fields },
    originalFields: row.originalFields ? { ...row.originalFields } : null,
  };
}

export function cloneRows(rows: HistoryDisplayRow[]): HistoryDisplayRow[] {
  return rows.map(cloneRow);
}

export function isNewDraft(row: HistoryDisplayRow): boolean {
  return row.payment === null && row.draftSource !== "none";
}

export function fieldsEqual(left: PaymentFields, right: PaymentFields): boolean {
  return normalizeAmount(left.amount) === normalizeAmount(right.amount)
    && normalizeAmount(left.fee) === normalizeAmount(right.fee)
    && left.method === right.method
    && left.kind === right.kind
    && left.depositType === right.depositType
    && left.paidAt.slice(0, 10) === right.paidAt.slice(0, 10)
    && left.memo === right.memo;
}

export interface LateFeeRowOptions {
  /** 조직 연체료 설정(setup_config). 없으면 기본값(사용·2%). */
  settings?: LateFeeSettings;
  /** 입주(occupancy)별 연체료 부과 여부(occupancies.late_fee_enabled). false 인 입주 건은 연체료 0. */
  lateFeeEnabledByOccupancy?: ReadonlyMap<number, boolean>;
  /** 연체료 부과 여부가 X인 입주 id(useLateFeeDisabledOccupancies). 들어 있으면 연체료 0. */
  lateFeeDisabledOccupancies?: ReadonlySet<number>;
  /** 이 호실의 수.연 미수금(get_payment_statement_data.late_fee_splits). 연체료 이전 행으로 그린다. */
  lateFeeSplits?: ReceiptLateFeeSplit[];
}

export function lateFeeForRow(
  rowPeriod: string,
  rowSummary: ReceiptStatementPaymentRow | ReceiptPaymentRow | undefined,
  tiers: RateTier[],
  asOfPeriod: string,
  options: LateFeeRowOptions = {},
): number {
  const occupancyId = rowSummary?.occupancyId;
  if (occupancyId != null && options.lateFeeEnabledByOccupancy?.get(occupancyId) === false) return 0;
  if (occupancyId != null && options.lateFeeDisabledOccupancies?.has(occupancyId)) return 0;
  const unpaidPrincipal = Math.max(rowSummary?.unpaid ?? 0, 0);
  // 수납 이력에서 직접 지정한 연체료가 있으면 그 금액(미납 원금이 남은 달만).
  const override = rowSummary?.lateFeeOverride;
  if (override != null) return unpaidPrincipal > 0 ? override : 0;
  const dueDate = rowSummary?.dueDate?.slice(0, 10);
  if (!unpaidPrincipal || !dueDate || dueDate >= todayInput()) return 0;

  const asOfYear = Number(asOfPeriod.slice(0, 4));
  const asOfMonth = Number(asOfPeriod.slice(5, 7));
  if (!Number.isInteger(asOfYear) || !Number.isInteger(asOfMonth)) return 0;

  const result = computeLateFeeForPeriod(
    {
      period: rowPeriod as Period,
      unpaidPrincipal,
      dueDate,
    },
    tiers,
    asOfYear,
    asOfMonth,
    options.settings,
  );
  return result.lateFee + result.postDueFee;
}

/**
 * 수납(연체료 포함)으로 이미 낸 연체료. 연체료는 별도 저장 없이 수납액에 합쳐 기록되므로, 그 달 수납 합계가
 * 당월계를 넘은 금액(unpaid < 0)을 수납된 연체료로 본다. 이게 없으면 전액 수납 후 미납 원금이 0이 되어
 * 연체 열이 비고 `당월계 ≠ 수납액`으로 보인다.
 */
export function collectedLateFeeForRow(
  rowSummary: ReceiptStatementPaymentRow | ReceiptPaymentRow | undefined,
): number {
  if (rowSummary?.charged == null || rowSummary.unpaid == null) return 0;
  return Math.max(-rowSummary.unpaid, 0);
}

/** 연체 열·영수증에 보이는 연체료 = 남은 연체료 + 이미 수납된 연체료. */
export function displayLateFee(row: Pick<HistoryDisplayRow, "lateFee" | "collectedLateFee">): number {
  return row.lateFee + row.collectedLateFee;
}

/** 그 달 원금 계산에서 수.연 연체료 수납분을 뺀다(연체료를 낸 것이지 원금을 낸 게 아니므로). */
function withoutSplitPaid<T extends ReceiptStatementPaymentRow | ReceiptPaymentRow>(
  rowSummary: T | undefined,
  splitPaid: number,
): T | undefined {
  if (!rowSummary || splitPaid <= 0) return rowSummary;
  return {
    ...rowSummary,
    paid: rowSummary.paid - splitPaid,
    unpaid: rowSummary.unpaid == null ? null : rowSummary.unpaid + splitPaid,
  };
}

export function buildHistoryRows(
  payments: HistoryPayment[],
  historySummaries: ReceiptStatementPaymentRow[] | undefined,
  summary: ReceiptPaymentRow | undefined,
  period: string,
  tiers: RateTier[],
  lateFeeOptions: LateFeeRowOptions = {},
): HistoryDisplayRow[] {
  const splits = lateFeeOptions.lateFeeSplits ?? [];
  const splitById = new Map(splits.map((split) => [split.id, split]));
  const isSplitPayment = (payment: HistoryPayment) =>
    payment.lateFeeSplitId != null && splitById.has(payment.lateFeeSplitId);
  const sumBy = <T,>(items: T[], value: (item: T) => number) =>
    items.reduce((total, item) => total + value(item), 0);

  // 서버는 조회 기간의 모든 달을 한 줄씩 준다. 부과(확정)도 수납도 없는 달은 0원 행으로 보여 데이터 오류처럼
  // 보이므로 뺀다. 지금 보고 있는 달은 고지 확정 전이어도 수납을 입력할 수 있게 남긴다.
  const sortedSummaries = historySummaries?.length
    ? [...historySummaries]
        .filter((row) =>
          row.charged != null
          || row.period === period
          || payments.some((payment) => (payment.period ?? period) === row.period)
          || splits.some((split) => split.period === row.period))
        .sort((left, right) => right.period.localeCompare(left.period))
    : [];

  const makeRow = (
    key: string,
    rowPeriod: string,
    rowSummary: ReceiptStatementPaymentRow | ReceiptPaymentRow | undefined,
    payment: HistoryPayment | null,
    /** 그 달 수.연으로 이미 나눈 연체료. 원 행의 연체료에서 뺀다. */
    splitLateFee = 0,
  ): HistoryDisplayRow => ({
    key,
    rowPeriod,
    rowSummary,
    dueDate: rowSummary?.dueDate ?? null,
    payment,
    fields: payment ? paymentFields(payment) : emptyFields(),
    originalFields: payment ? paymentFields(payment) : null,
    lateFee: Math.max(lateFeeForRow(rowPeriod, rowSummary, tiers, period, lateFeeOptions) - splitLateFee, 0),
    collectedLateFee: collectedLateFeeForRow(rowSummary),
    draftSource: "none",
    lateOnly: false,
    cancelRequested: false,
    cancelCompleted: false,
    restoreRequested: false,
    saved: false,
  });

  /** 수.연 미수금 행: 연결된 수납마다 한 줄, 첫 줄에 남은·받은 연체료를 싣는다. 수납이 없으면 빈 수납 한 줄. */
  const makeSplitRows = (split: ReceiptLateFeeSplit, dueDate: string | null): HistoryDisplayRow[] => {
    const linked = payments.filter((payment) => payment.lateFeeSplitId === split.id);
    const paid = sumBy(linked.filter((payment) => payment.status === "active"), (payment) => payment.amount);
    const base = (key: string, payment: HistoryPayment | null, first: boolean): HistoryDisplayRow => ({
      key,
      rowPeriod: split.period,
      rowSummary: undefined,
      dueDate,
      payment,
      fields: payment ? paymentFields(payment) : { ...emptyFields(), memo: split.memo ?? "" },
      originalFields: payment ? paymentFields(payment) : null,
      lateFee: first ? Math.max(split.amount - paid, 0) : 0,
      collectedLateFee: first ? Math.min(paid, split.amount) : 0,
      draftSource: "none",
      lateOnly: true,
      split,
      cancelRequested: false,
      cancelCompleted: false,
      restoreRequested: false,
      saved: false,
    });
    if (linked.length === 0) return [base(`split-${split.id}`, null, true)];
    return linked.map((payment, index) => base(`payment-${payment.id}`, payment, index === 0));
  };

  if (sortedSummaries.length === 0) {
    if (payments.length === 0) {
      return [makeRow(`empty-${period}`, period, summary, null)];
    }
    return payments.map((payment, index) => makeRow(
      `payment-${payment.id}`,
      payment.period ?? period,
      index === 0 ? summary : undefined,
      payment,
    ));
  }

  const rows: HistoryDisplayRow[] = [];
  for (const rawSummary of sortedSummaries) {
    const periodSplits = splits.filter((split) => split.period === rawSummary.period);
    const splitPaid = sumBy(
      payments.filter((payment) =>
        payment.status === "active"
        && isSplitPayment(payment)
        && (payment.period ?? period) === rawSummary.period),
      (payment) => payment.amount,
    );
    const splitLateFee = sumBy(periodSplits, (split) => split.amount);
    const rowSummary = withoutSplitPaid(rawSummary, splitPaid);
    // 정본처럼 나눈 연체료 행을 원 행 위에 둔다.
    for (const split of periodSplits) rows.push(...makeSplitRows(split, rawSummary.dueDate ?? null));

    const periodPayments = payments.filter(
      (payment) => (payment.period ?? period) === rawSummary.period && !isSplitPayment(payment),
    );
    if (periodPayments.length === 0) {
      rows.push(makeRow(`summary-${rawSummary.period}`, rawSummary.period, rowSummary, null, splitLateFee));
      continue;
    }
    periodPayments.forEach((payment, index) => {
      rows.push(makeRow(
        `payment-${payment.id}`,
        rawSummary.period,
        index === 0 ? rowSummary : undefined,
        payment,
        splitLateFee,
      ));
    });
  }
  return rows;
}
