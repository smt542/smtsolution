import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import type { LockDraft } from "../UtilityLock";

export interface GasUtilityDraft extends LockDraft {
  currentReading: string;
  manualCharge: string;
  note: string;
}

export type GasTableRow = UtilityUnitRow;
