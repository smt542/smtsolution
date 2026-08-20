import type {
  PayStatus,
  PaymentKind,
  PaymentMethod,
} from "@/hooks/reactquery/payments";

export const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  unbilled: "미확정",
  unpaid: "미납",
  partial: "부분납",
  paid: "완납",
  over: "과납",
};

export const PAY_STATUS_STYLE: Record<PayStatus, string> = {
  unbilled: "bg-bg text-t2",
  unpaid: "bg-red-t text-red",
  partial: "bg-amber-t text-amber",
  paid: "bg-green-t text-green",
  over: "bg-blue-t text-blue",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "현금",
  transfer: "계좌이체",
  auto_debit: "자동이체",
  giro: "지로",
  card: "카드",
  other: "기타",
};

const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "transfer",
  "auto_debit",
  "giro",
  "card",
  "other",
];

export const METHOD_OPTIONS = PAYMENT_METHODS.map((value) => ({
  value,
  label: METHOD_LABEL[value],
}));

export const KIND_LABEL: Record<PaymentKind, string> = {
  full: "수납",
  principal: "원금",
  partial: "분할",
};
