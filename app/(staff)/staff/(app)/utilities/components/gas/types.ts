import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import type { LockDraft } from "../UtilityLock";

export interface GasUtilityDraft extends LockDraft {
  previousReading: string;
  currentReading: string;
  usage: string;
  usageEdited: boolean;
  manualCharge: string;
  note: string;
}

export type GasTableRow = UtilityUnitRow;
