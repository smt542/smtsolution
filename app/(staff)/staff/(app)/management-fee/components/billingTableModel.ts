import type { BillingColumn, BillingUnitRow } from "@/lib/billing/pivot";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities/apis";
import { effectiveAmount } from "@/lib/billing/proration";
import { unitTotal, type ChargeLine } from "@/lib/billing/total";

export type BillingChargeDraft = { charged: boolean; amount: number };
export type BillingNoteDraft = { billingNote: string; unitNotice: string };

/** 3개 공과금(수도·전기·가스) 행 배열을 함께 넘긴다. page.tsx가 useUtilityRows로 조회한 값. */
export type UtilityRowSet = {
  water: UtilityUnitRow[];
  electricity: UtilityUnitRow[];
  gas: UtilityUnitRow[];
};

export const EMPTY_UTILITY_ROWS: UtilityRowSet = { water: [], electricity: [], gas: [] };

/**
 * 항목 컬럼을 최대 3개씩 묶은 그룹(TRIOS). 원본 `.mf-ih2` 헤더 셀 하나에 이름 3개가 들어간다.
 * 정렬은 이미 pivot에서 sortOrder로 끝난 상태이므로 순서 그대로 청크만 한다.
 */
export function chunkTrios(columns: BillingColumn[]): BillingColumn[][] {
  const trios: BillingColumn[][] = [];
  for (let i = 0; i < columns.length; i += 3) trios.push(columns.slice(i, i + 3));
  return trios;
}

export function isRecentMoveIn(moveInDate: string | null, period: string): boolean {
  return Boolean(moveInDate && moveInDate.slice(0, 7) === period.slice(0, 7));
}

/** 세대의 평수. list_billing이 units.area_pyeong을 반환하고 pivot이 areaPyeong으로 전달한다(마이그 0151). */
export function unitAreaPyeong(unit: BillingUnitRow): number | null {
  return unit.areaPyeong;
}

/** 특정 공과금 유형에서 이 세대의 금액. manualCharge ?? automaticCharge ?? 0. */
function utilityChargeFor(rows: UtilityUnitRow[], unitId: number): number {
  const row = rows.find((r) => r.unitId === unitId);
  if (!row) return 0;
  return row.manualCharge ?? row.automaticCharge ?? 0;
}

export type UnitUtilityAmounts = { water: number; electricity: number; gas: number; sum: number };

export function unitUtilityAmounts(unitId: number, utilities: UtilityRowSet): UnitUtilityAmounts {
  const water = utilityChargeFor(utilities.water, unitId);
  const electricity = utilityChargeFor(utilities.electricity, unitId);
  const gas = utilityChargeFor(utilities.gas, unitId);
  return { water, electricity, gas, sum: water + electricity + gas };
}

/** 항목(fee item) 합계만 — 일할/반올림은 effectiveAmount로 반영. 공과금은 제외. */
export function billingItemsTotal(
  unit: BillingUnitRow,
  columns: BillingColumn[],
  period: string,
  drafts?: Record<number, BillingChargeDraft>,
): number {
  if (unit.isVacant) return 0;
  const lines: ChargeLine[] = columns.map((column) => {
    const cell = drafts?.[column.feeItemId] ?? unit.charges[column.feeItemId] ?? { charged: true, amount: 0 };
    return { charged: cell.charged, amount: cell.amount, dailyProration: column.dailyProration, rounding: column.rounding };
  });
  return unitTotal(lines, unit.moveInDate, period);
}

/** 총 관리비 line1 = 항목 합계 + 공과금 3종 합계. 공실은 0. */
export function billingRowTotal(
  unit: BillingUnitRow,
  columns: BillingColumn[],
  period: string,
  utilities: UtilityRowSet,
  drafts?: Record<number, BillingChargeDraft>,
): number {
  if (unit.isVacant) return 0;
  return billingItemsTotal(unit, columns, period, drafts) + unitUtilityAmounts(unit.unitId, utilities).sum;
}

/** 항목 셀의 화면 표시 금액(일할·반올림 반영값). 원본 proRate 대응. */
export function effectiveChargeAmount(
  column: BillingColumn,
  amount: number,
  moveInDate: string | null,
  period: string,
): number {
  return effectiveAmount(amount, { dailyProration: column.dailyProration, rounding: column.rounding }, moveInDate, period);
}
