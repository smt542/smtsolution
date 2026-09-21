import type { OverdueHousehold } from "@/hooks/reactquery/overdue";

export const DEBT_COLLECTION_MIN_MONTHS = 2;
export const DEBT_COLLECTION_MIN_AMOUNT = 100_000;

export function isDebtCollectionTarget(row: OverdueHousehold): boolean {
  return (
    row.overdueMonths >= DEBT_COLLECTION_MIN_MONTHS &&
    row.overdueAmount + (row.lateFeeAmount ?? 0) + (row.postDueFeeAmount ?? 0)
      >= DEBT_COLLECTION_MIN_AMOUNT
  );
}
