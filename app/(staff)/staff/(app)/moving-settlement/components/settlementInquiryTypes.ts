import type { SettlementInquiryRow } from "@/hooks/reactquery/movingSettlement";

export type EditableInquiryField =
  | "elecPaidDate"
  | "gasPaidDate"
  | "cleaningCost";

export interface SettlementInquiryEdit {
  elecPaidDate?: string;
  gasPaidDate?: string;
  cleaningCost?: string;
}

export type SettlementInquiryEdits = Record<number, SettlementInquiryEdit>;

export interface SettlementInquiryGroup {
  key: string;
  address: string;
  buildingName: string;
  rows: SettlementInquiryRow[];
}

export function groupSettlementRows(
  rows: SettlementInquiryRow[],
): SettlementInquiryGroup[] {
  const groups = new Map<string, SettlementInquiryGroup>();

  for (const row of rows) {
    const key = `${row.buildingId}:${row.buildingCode}`;
    const current = groups.get(key);
    if (current) {
      current.rows.push(row);
      continue;
    }
    groups.set(key, {
      key,
      address: locationLabel(row.buildingAddress, row.dong),
      buildingName: row.buildingName,
      rows: [row],
    });
  }

  return [...groups.values()];
}

/**
 * 정본 호실 셀은 접미사 없는 숫자다(404·101). DB `units.unit_no` 는 "101호" 로 저장하는데
 * 57px 컬럼에서 접미사까지 넣으면 두 줄로 접힌다. 표시에서만 뗀다(aria-label 은 "101호" 유지).
 */
export function unitNoLabel(unitNo: string | null): string {
  return (unitNo ?? "").replace(/호$/, "");
}

export function locationLabel(
  address: string | null,
  fallback: string | null,
): string {
  if (!address) return fallback ?? "";
  const locality = address
    .split(/\s+/)
    .reverse()
    .find((part) => /[동읍면리]$/.test(part));
  return locality ?? fallback ?? address;
}

export function monthEnd(year: string, month: string): string {
  const end = new Date(Number(year), Number(month), 0).getDate();
  return `${year}-${month}-${String(end).padStart(2, "0")}`;
}

export function numericInput(value: string): string {
  const sign = value.trimStart().startsWith("-") ? "-" : "";
  return `${sign}${value.replace(/[^0-9]/g, "")}`;
}

export function displayNumericInput(value: string): string {
  if (value === "" || value === "-") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("ko-KR") : "";
}

export function parseNumericInput(value: string): number | null {
  if (value === "" || value === "-") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}
