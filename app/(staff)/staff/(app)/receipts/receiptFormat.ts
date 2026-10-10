import {
  formatDateTime as formatSharedDateTime,
  formatNumber,
} from "@/lib/format";
import type { PayStatus } from "@/lib/payments/status";

/** 세대중심 수납관리 화면 공용 표시 헬퍼. (구 PaymentStatusSection 헬퍼 승계) */

export function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : formatNumber(value);
}

export function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "-";
}

export function formatDateTime(value: string | null | undefined): string {
  return formatSharedDateTime(value, { nullText: "-" });
}

export function unitLabel(row: { dong?: string | null; unitNo?: string | null }): string {
  const unitNo = row.unitNo
    ? row.unitNo.endsWith("호")
      ? row.unitNo
      : `${row.unitNo}호`
    : null;
  return [row.dong, unitNo].filter(Boolean).join(" ");
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

/** 수납 구분(정책): 일반·지로·이체·무통. 그 외 값은 과거·연동 데이터 표시용. */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  general: "일반",
  deposit: "무통",
  cash: "현금",
  transfer: "이체",
  auto_debit: "자동이체",
  giro: "지로",
  card: "카드",
  other: "기타",
};

/** 수납 이력 「구분」에서 고를 수 있는 값(정책 순서). */
export const POLICY_PAYMENT_METHODS = ["general", "giro", "transfer", "deposit"] as const;

/** 입금 은행(수납): 수납 이력 「은행」 */
export const DEPOSIT_TYPE_LABEL: Record<string, string> = {
  bankbook: "무통장입금",
  giro: "지로입금",
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
