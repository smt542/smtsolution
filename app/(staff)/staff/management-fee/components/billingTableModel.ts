import type { BillingColumn, BillingUnitRow } from "@/lib/billing/pivot";
import { unitTotal, type ChargeLine } from "@/lib/billing/total";

export type BillingChargeDraft = { charged: boolean; amount: number };
export type BillingNoteDraft = { billingNote: string; unitNotice: string };
export type BillingColumnGroup = { label: string; columns: BillingColumn[] };

export function groupBillingColumns(columns: BillingColumn[]): BillingColumnGroup[] {
  const groups: BillingColumnGroup[] = [
    { label: "관리비", columns: [] },
    { label: "공과금", columns: [] },
    { label: "수리비", columns: [] },
  ];
  columns.forEach((column) => {
    if (/수도|전기|가스/.test(column.name)) groups[1].columns.push(column);
    else if (/수리/.test(column.name)) groups[2].columns.push(column);
    else groups[0].columns.push(column);
  });
  return groups.filter((group) => group.columns.length > 0);
}

export function isRecentMoveIn(moveInDate: string | null, period: string): boolean {
  return Boolean(moveInDate && moveInDate.slice(0, 7) === period.slice(0, 7));
}

export function billingRowTotal(
  unit: BillingUnitRow,
  columns: BillingColumn[],
  period: string,
  drafts?: Record<number, BillingChargeDraft>,
): number {
  if (unit.isVacant) return 0;
  const lines: ChargeLine[] = columns.map((column) => {
    const cell = drafts?.[column.feeItemId] ?? unit.charges[column.feeItemId] ?? { charged: true, amount: 0 };
    return {
      charged: cell.charged,
      amount: cell.amount,
      dailyProration: column.dailyProration,
      rounding: column.rounding,
    };
  });
  return unitTotal(lines, unit.moveInDate, period);
}
