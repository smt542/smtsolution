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
