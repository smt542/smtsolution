import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";

export interface GasUtilityDraft {
  currentReading: string;
  manualCharge: string;
  note: string;
}

export interface GasTableRow extends UtilityUnitRow {
  fixedUsage: number | null;
  fixedUsageFrom?: string | null;
}
