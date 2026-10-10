import type { PaymentKind, PaymentMethod, UnitPayment } from "@/hooks/reactquery/payments";
import {
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
  lateFee: number;
  draftSource: DraftSource;
  lateOnly: boolean;
  cancelRequested: boolean;
  cancelCompleted: boolean;
  /** 삭제(취소)된 수납을 저장 시 되살리도록 예약 */
  restoreRequested: boolean;
  saved: boolean;
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
  return { amount: "", fee: "0", method, kind, paidAt: "", memo: "" };
}

function paymentFields(payment: HistoryPayment): PaymentFields {
  return {
    amount: formatInputNumber(payment.amount),
    fee: formatInputNumber(payment.fee),
    method: payment.method,
    kind: payment.kind,
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

export function buildHistoryRows(
  payments: HistoryPayment[],
  historySummaries: ReceiptStatementPaymentRow[] | undefined,
  summary: ReceiptPaymentRow | undefined,
  period: string,
  tiers: RateTier[],
  lateFeeOptions: LateFeeRowOptions = {},
): HistoryDisplayRow[] {
  // 서버는 조회 기간의 모든 달을 한 줄씩 준다. 부과(확정)도 수납도 없는 달은 0원 행으로 보여 데이터 오류처럼
  // 보이므로 뺀다. 지금 보고 있는 달은 고지 확정 전이어도 수납을 입력할 수 있게 남긴다.
  const sortedSummaries = historySummaries?.length
    ? [...historySummaries]
        .filter((row) =>
          row.charged != null
          || row.period === period
          || payments.some((payment) => (payment.period ?? period) === row.period))
        .sort((left, right) => right.period.localeCompare(left.period))
    : [];

  const makeRow = (
    key: string,
    rowPeriod: string,
    rowSummary: ReceiptStatementPaymentRow | ReceiptPaymentRow | undefined,
    payment: HistoryPayment | null,
  ): HistoryDisplayRow => ({
    key,
    rowPeriod,
    rowSummary,
    dueDate: rowSummary?.dueDate ?? null,
    payment,
    fields: payment ? paymentFields(payment) : emptyFields(),
    originalFields: payment ? paymentFields(payment) : null,
    lateFee: lateFeeForRow(rowPeriod, rowSummary, tiers, period, lateFeeOptions),
    draftSource: "none",
    lateOnly: false,
    cancelRequested: false,
    cancelCompleted: false,
    restoreRequested: false,
    saved: false,
  });

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
  for (const rowSummary of sortedSummaries) {
    const periodPayments = payments.filter(
      (payment) => (payment.period ?? period) === rowSummary.period,
    );
    if (periodPayments.length === 0) {
      rows.push(makeRow(`summary-${rowSummary.period}`, rowSummary.period, rowSummary, null));
      continue;
    }
    periodPayments.forEach((payment, index) => {
      rows.push(makeRow(
        `payment-${payment.id}`,
        rowSummary.period,
        index === 0 ? rowSummary : undefined,
        payment,
      ));
    });
  }
  return rows;
}
