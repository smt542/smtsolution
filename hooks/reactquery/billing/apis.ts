import { createClient } from "@/lib/supabase/client";
import type { BillingFlatRow } from "@/lib/billing/pivot";

type BillingFlatDbRow = {
  unit_id: number; unit_no: string; dong: string | null; room_type_label: string | null;
  occupancy_id: number | null; tenant_name: string | null; move_in_date: string | null; is_vacant: boolean;
  fee_item_id: number; fee_item_name: string; carry_over: boolean; daily_proration: boolean;
  rounding: string; is_required: boolean; sort_order: number;
  charged: boolean; amount: number;
  confirmed_at: string | null; confirmed_by_name: string | null; total_amount: number | null;
  billing_note: string | null; unit_notice: string | null; is_dirty: boolean;
};

const rowToFlat = (r: BillingFlatDbRow): BillingFlatRow => ({
  unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, roomTypeLabel: r.room_type_label,
  occupancyId: r.occupancy_id, tenantName: r.tenant_name, moveInDate: r.move_in_date, isVacant: r.is_vacant,
  feeItemId: r.fee_item_id, feeItemName: r.fee_item_name, carryOver: r.carry_over, dailyProration: r.daily_proration,
  rounding: r.rounding as BillingFlatRow["rounding"], isRequired: r.is_required, sortOrder: r.sort_order,
  charged: r.charged, amount: r.amount,
  confirmedAt: r.confirmed_at, confirmedByName: r.confirmed_by_name, totalAmount: r.total_amount,
  billingNote: r.billing_note, unitNotice: r.unit_notice, isDirty: r.is_dirty,
});

export interface BillingHistoryItem { feeItemId: number; name: string; charged: boolean; amount: number; }
export interface BillingHistoryEntry { period: string; totalAmount: number; items: BillingHistoryItem[]; confirmedAt: string; }

type HistoryDbItem = { fee_item_id: number; name: string; charged: boolean; amount: number };
type HistoryDbRow = { period: string; total_amount: number; items: HistoryDbItem[] | null; confirmed_at: string };

const rowToHistory = (r: HistoryDbRow): BillingHistoryEntry => ({
  period: r.period, totalAmount: r.total_amount, confirmedAt: r.confirmed_at,
  items: (r.items ?? []).map((i) => ({ feeItemId: i.fee_item_id, name: i.name, charged: i.charged, amount: i.amount })),
});

export async function listBilling(buildingId: number, period: string): Promise<BillingFlatRow[]> {
  const { data, error } = await createClient().rpc("list_billing", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as BillingFlatDbRow[]).map(rowToFlat);
}

export async function listBillingHistory(unitId: number, period: string, months = 6): Promise<BillingHistoryEntry[]> {
  const { data, error } = await createClient().rpc("list_billing_history", { p_unit_id: unitId, p_period: period, p_months: months });
  if (error) throw new Error(error.message);
  return ((data ?? []) as HistoryDbRow[]).map(rowToHistory);
}

export interface SaveBillingChargesPayload {
  buildingId: number; period: string;
  charges: { unitId: number; feeItemId: number; charged: boolean; amount: number; occupancyId?: number | null }[];
  notes: { unitId: number; billingNote: string | null; unitNotice: string | null }[];
}

export async function saveBillingCharges(p: SaveBillingChargesPayload): Promise<void> {
  const { error } = await createClient().rpc("save_billing_charges", {
    p_building_id: p.buildingId,
    p_period: p.period,
    p_charges: p.charges.map((c) => ({
      unit_id: c.unitId, fee_item_id: c.feeItemId, charged: c.charged, amount: c.amount, occupancy_id: c.occupancyId ?? null,
    })),
    p_notes: p.notes.map((n) => ({ unit_id: n.unitId, billing_note: n.billingNote, unit_notice: n.unitNotice })),
  });
  if (error) throw new Error(error.message);
}

export interface ConfirmBillingResult { unitCount: number; total: number; }

export async function confirmBilling(buildingId: number, period: string): Promise<ConfirmBillingResult> {
  const { data, error } = await createClient().rpc("confirm_billing", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  const r = data as { unit_count: number; total: number };
  return { unitCount: r.unit_count, total: r.total };
}
