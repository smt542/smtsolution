import type { HqRole } from "@/hooks/reactquery/platform";

export const HQ_ROLE_LABELS: Record<HqRole, string> = {
  master: "마스터",
  operations: "운영",
  support: "지원",
  sales: "영업",
  accounting: "회계",
  other: "기타",
};

export const HQ_ROLE_OPTIONS: Array<{ value: HqRole; label: string }> = [
  { value: "master", label: HQ_ROLE_LABELS.master },
  { value: "operations", label: HQ_ROLE_LABELS.operations },
  { value: "support", label: HQ_ROLE_LABELS.support },
  { value: "sales", label: HQ_ROLE_LABELS.sales },
  { value: "accounting", label: HQ_ROLE_LABELS.accounting },
  { value: "other", label: HQ_ROLE_LABELS.other },
];
