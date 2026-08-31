import type { ComplaintStatus } from "@/hooks/reactquery/complaints";
import { formatDateIntl, formatDateTime } from "@/lib/format";

export const COMPLAINT_STATUS_OPTIONS: {
  value: ComplaintStatus;
  label: string;
}[] = [
  { value: "pending", label: "미결" },
  { value: "completed", label: "완결" },
  { value: "on_hold", label: "보류" },
  { value: "repeat", label: "반복" },
];

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  pending: "미결",
  completed: "완결",
  on_hold: "보류",
  repeat: "반복",
};

export const COMPLAINT_STATUS_STYLE: Record<ComplaintStatus, string> = {
  pending: "bg-amber-t text-amber",
  completed: "bg-green-t text-green",
  on_hold: "bg-bg text-t2",
  repeat: "bg-red-t text-red",
};

export function formatComplaintDate(value?: string | null, includeTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  if (includeTime) return formatDateTime(value, { nullText: "-" });
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
  return formatDateIntl(localDate, { nullText: "-" });
}

export function formatUnitLabel(unit?: {
  unitNo?: string | null;
  dong?: string | null;
}) {
  if (!unit?.unitNo) return "공용·호실 미지정";
  return unit.dong ? `${unit.dong} ${unit.unitNo}` : unit.unitNo;
}

export function startOfDayIso(value: string) {
  return value ? new Date(`${value}T00:00:00+09:00`).toISOString() : undefined;
}

export function endOfDayIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999+09:00`).toISOString() : undefined;
}
