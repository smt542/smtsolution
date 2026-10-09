import type { OverdueHousehold } from "@/hooks/reactquery/overdue";

export const DEBT_COLLECTION_MIN_MONTHS = 2;
export const DEBT_COLLECTION_MIN_AMOUNT = 100_000;

/** 세대의 월분별 경과 개월(lateFeeByPeriod.months) 최댓값. 연체료 계산 전이면 집계값(미납 월 수)으로 대체. */
export function maxOverdueMonths(row: OverdueHousehold): number {
  const months = (row.lateFeeByPeriod ?? []).map((item) => item.months);
  return months.length > 0 ? Math.max(...months) : row.overdueMonths;
}

export function isDebtCollectionTarget(row: OverdueHousehold): boolean {
  return (
    maxOverdueMonths(row) >= DEBT_COLLECTION_MIN_MONTHS &&
    row.overdueAmount + (row.lateFeeAmount ?? 0) + (row.postDueFeeAmount ?? 0)
      >= DEBT_COLLECTION_MIN_AMOUNT
  );
}
