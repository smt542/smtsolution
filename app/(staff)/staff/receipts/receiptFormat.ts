import type { PayStatus } from "@/lib/payments/status";

/** 세대중심 수납관리 화면 공용 표시 헬퍼. (구 PaymentStatusSection 헬퍼 승계) */

export function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : `${value.toLocaleString("ko-KR")}원`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function unitLabel(row: { dong?: string | null; unitNo?: string | null }): string {
  return [row.dong, row.unitNo].filter(Boolean).join(" ");
}

export const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  unbilled: "미부과",
  unpaid: "미납",
  partial: "부분수납",
  paid: "수납완료",
  over: "초과수납",
};

export const PAY_STATUS_STYLE: Record<PayStatus, string> = {
  unbilled: "bg-bg text-t3",
  unpaid: "bg-red-t text-red",
  partial: "bg-amber-t text-amber",
  paid: "bg-green-t text-green",
  over: "bg-blue-t text-blue",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "현금",
  transfer: "계좌이체",
  auto_debit: "자동이체",
  giro: "지로",
  card: "카드",
  other: "기타",
};

export const PAYMENT_KIND_LABEL: Record<string, string> = {
  full: "완납",
  principal: "원금",
  partial: "부분",
};

export const TRANSFER_METHOD_LABEL: Record<string, string> = {
  giro: "지로",
  transfer: "계좌이체",
  auto_transfer: "자동이체",
  deposit: "무통장",
  none: "없음",
};

export const BILL_DELIVERY_LABEL: Record<string, string> = {
  post: "우편",
  alimtalk: "알림톡",
};

/**
 * 자동수납·출력은 P3/P4에서 이 화면으로 인라인 흡수될 예정.
 * P1 동안은 기존 /staff/payment 화면으로 deep-link 유지.
 */
export function unitPaymentLink(
  buildingId: number,
  unitId: number,
  period: string,
  view: "history" | "statement" | "receipt",
): string {
  return `/staff/payment?${new URLSearchParams({
    buildingId: String(buildingId),
    unitId: String(unitId),
    period,
    view,
  }).toString()}`;
}

export function villaPaymentLink(
  buildingId: number,
  period: string,
  view: "amount" | "unpaid" | "paid",
): string {
  return `/staff/payment?${new URLSearchParams({
    buildingId: String(buildingId),
    period,
    villa: view,
  }).toString()}`;
}

export function autoPayLink(
  buildingId: number | null,
  period: string,
  giro: "pay" | "ledger" | "date" | "bank" | "bankForm",
): string {
  const params = new URLSearchParams({ period, giro });
  if (buildingId) params.set("buildingId", String(buildingId));
  return `/staff/payment?${params.toString()}`;
}
