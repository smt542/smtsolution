import type { OverdueHousehold } from "@/hooks/reactquery/overdue";
import {
  formatDate as formatSharedDate,
  formatWon as formatSharedWon,
} from "@/lib/format";

export const DEBT_COLLECTION_MIN_MONTHS = 2;
export const DEBT_COLLECTION_MIN_AMOUNT = 100_000;

export function isDebtCollectionTarget(row: OverdueHousehold): boolean {
  return (
    row.overdueMonths >= DEBT_COLLECTION_MIN_MONTHS &&
    row.overdueAmount + (row.lateFeeAmount ?? 0) >= DEBT_COLLECTION_MIN_AMOUNT
  );
}

export function formatWon(amount: number): string {
  return formatSharedWon(amount);
}

export function formatDate(value?: string | null): string {
  return formatSharedDate(value);
}
