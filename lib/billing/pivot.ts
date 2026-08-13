import type { Rounding } from "./proration";

export interface BillingFlatRow {
  unitId: number; unitNo: string; dong: string | null; roomTypeLabel: string | null;
  occupancyId: number | null; tenantName: string | null; moveInDate: string | null; isVacant: boolean;
  feeItemId: number; feeItemName: string; carryOver: boolean; dailyProration: boolean;
  rounding: Rounding; isRequired: boolean; sortOrder: number;
  charged: boolean; amount: number;
  confirmedAt: string | null; confirmedByName: string | null; totalAmount: number | null;
  billingNote: string | null; unitNotice: string | null; isDirty: boolean;
}

export interface BillingColumn {
  feeItemId: number; name: string; carryOver: boolean; dailyProration: boolean;
  rounding: Rounding; isRequired: boolean; sortOrder: number;
}

export interface BillingUnitRow {
  unitId: number; unitNo: string; dong: string | null; roomTypeLabel: string | null;
  occupancyId: number | null; tenantName: string | null; moveInDate: string | null; isVacant: boolean;
  confirmedAt: string | null; confirmedByName: string | null; totalAmount: number | null;
  billingNote: string | null; unitNotice: string | null; isDirty: boolean;
  charges: Record<number, { charged: boolean; amount: number }>;
}

export function pivotBillingRows(rows: BillingFlatRow[]): { units: BillingUnitRow[]; columns: BillingColumn[] } {
  const colMap = new Map<number, BillingColumn>();
  const unitMap = new Map<number, BillingUnitRow>();

  for (const r of rows) {
    if (!colMap.has(r.feeItemId)) {
      colMap.set(r.feeItemId, {
        feeItemId: r.feeItemId, name: r.feeItemName, carryOver: r.carryOver,
        dailyProration: r.dailyProration, rounding: r.rounding, isRequired: r.isRequired, sortOrder: r.sortOrder,
      });
    }
    if (!unitMap.has(r.unitId)) {
      unitMap.set(r.unitId, {
        unitId: r.unitId, unitNo: r.unitNo, dong: r.dong, roomTypeLabel: r.roomTypeLabel,
        occupancyId: r.occupancyId, tenantName: r.tenantName, moveInDate: r.moveInDate, isVacant: r.isVacant,
        confirmedAt: r.confirmedAt, confirmedByName: r.confirmedByName, totalAmount: r.totalAmount,
        billingNote: r.billingNote, unitNotice: r.unitNotice, isDirty: r.isDirty, charges: {},
      });
    }
    unitMap.get(r.unitId)!.charges[r.feeItemId] = { charged: r.charged, amount: r.amount };
  }

  const columns = [...colMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const units = [...unitMap.values()].sort((a, b) => a.unitNo.localeCompare(b.unitNo, "ko", { numeric: true }));
  return { units, columns };
}
