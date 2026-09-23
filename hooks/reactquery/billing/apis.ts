import { createClient } from "@/lib/supabase/client";
import type { BillingFlatRow } from "@/lib/billing/pivot";
import { defaultChargePeriod, prevPeriod } from "@/lib/billing/period";

type BillingFlatDbRow = {
  unit_id: number; unit_no: string; dong: string | null; room_type_label: string | null;
  area_pyeong: number | string | null;
  occupancy_id: number | null; tenant_name: string | null; move_in_date: string | null; is_vacant: boolean;
  mgmt_fee_amount: number | string | null;
  fee_item_id: number; fee_item_name: string; carry_over: boolean; daily_proration: boolean;
  rounding: string; is_required: boolean; sort_order: number;
  charged: boolean; amount: number;
  confirmed_at: string | null; confirmed_by_name: string | null; total_amount: number | null;
  billing_note: string | null; unit_notice: string | null; is_dirty: boolean;
};

const rowToFlat = (r: BillingFlatDbRow): BillingFlatRow => ({
  unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, roomTypeLabel: r.room_type_label,
  areaPyeong: r.area_pyeong == null ? null : Number(r.area_pyeong),
  occupancyId: r.occupancy_id, tenantName: r.tenant_name, moveInDate: r.move_in_date, isVacant: r.is_vacant,
  mgmtFeeAmount: r.mgmt_fee_amount == null ? null : Number(r.mgmt_fee_amount),
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

export interface CopyPreviousBillingResult {
  unitCount: number;
  chargeCount: number;
}

/** 현재 월에 존재하는 세대·항목을 기준으로 전월 금액과 메모를 덮어쓴다. */
export async function copyPreviousBilling(
  buildingId: number,
  period: string,
): Promise<CopyPreviousBillingResult> {
  const [previousRows, currentRows] = await Promise.all([
    listBilling(buildingId, prevPeriod(period)),
    listBilling(buildingId, period),
  ]);
  // 필수 공과금 항목(전기·수도료·가스)은 저장값이 없으면 그 달 산정값이 기본값이라(마이그 0193)
  // 전월 금액을 저장해 고정하지 않는다.
  const previousByCell = new Map(
    previousRows
      .filter((row) => row.carryOver && !row.isRequired)
      .map((row) => [`${row.unitId}:${row.feeItemId}`, row]),
  );
  const charges = currentRows.flatMap((current) => {
    const previous = previousByCell.get(`${current.unitId}:${current.feeItemId}`);
    return previous
      ? [{
          unitId: current.unitId,
          feeItemId: current.feeItemId,
          charged: previous.charged,
          amount: previous.amount,
          occupancyId: current.occupancyId,
        }]
      : [];
  });
  const unitIds = [...new Set(charges.map((charge) => charge.unitId))];
  if (charges.length > 0) {
    await saveBillingCharges({ buildingId, period, charges, notes: [] });
  }
  const previousSetting = await getBillingPeriodSetting(buildingId, prevPeriod(period));
  await saveBillingPeriodSetting({
    buildingId,
    period,
    chargeStartDate: shiftMonth(previousSetting.chargeStartDate),
    chargeEndDate: shiftMonth(previousSetting.chargeEndDate),
    dueDate: previousSetting.dueDate ? shiftMonth(previousSetting.dueDate) : null,
  });
  return { unitCount: unitIds.length, chargeCount: charges.length };
}

function shiftMonth(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const lastDay = new Date(nextYear, nextMonth, 0).getDate();
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export interface ConfirmBillingResult { unitCount: number; total: number; }

export async function confirmBilling(buildingId: number, period: string): Promise<ConfirmBillingResult> {
  const { data, error } = await createClient().rpc("confirm_billing", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  const r = data as { unit_count: number; total: number };
  return { unitCount: r.unit_count, total: r.total };
}

// ===== §3.3 신규 입주자 당월 부과 =====
export interface NewOccupancy {
  unitId: number; unitNo: string; dong: string | null; tenantName: string | null; moveInDate: string | null;
}
type NewOccupancyDbRow = {
  unit_id: number; unit_no: string; dong: string | null; tenant_name: string | null; move_in_date: string | null;
};
const rowToNewOcc = (r: NewOccupancyDbRow): NewOccupancy => ({
  unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, tenantName: r.tenant_name, moveInDate: r.move_in_date,
});

// 부과확정 이후 등록된 미부과 신규 세대 목록
export async function listUnchargedNewOccupancies(buildingId: number, period: string): Promise<NewOccupancy[]> {
  const { data, error } = await createClient().rpc("list_uncharged_new_occupancies", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as NewOccupancyDbRow[]).map(rowToNewOcc);
}

// 감지된 신규 세대 중 선택분만 당월 부과
export async function chargeNewOccupancies(buildingId: number, period: string, unitIds: number[]): Promise<ConfirmBillingResult> {
  const { data, error } = await createClient().rpc("charge_new_occupancies", {
    p_building_id: buildingId, p_period: period, p_unit_ids: unitIds,
  });
  if (error) throw new Error(error.message);
  const r = data as { unit_count: number; total: number };
  return { unitCount: r.unit_count, total: r.total };
}

export interface BillingPeriodSetting {
  buildingId: number;
  period: string;
  chargeStartDate: string;
  chargeEndDate: string;
  dueDate: string | null;
  isSaved: boolean;
}

type BillingPeriodSettingDbRow = {
  building_id: number;
  period: string;
  charge_start_date: string;
  charge_end_date: string;
  due_date: string | null;
};

const rowToPeriodSetting = (row: BillingPeriodSettingDbRow): BillingPeriodSetting => ({
  buildingId: row.building_id,
  period: row.period,
  chargeStartDate: row.charge_start_date,
  chargeEndDate: row.charge_end_date,
  dueDate: row.due_date,
  isSaved: true,
});

export function defaultBillingPeriodSetting(buildingId: number, period: string): BillingPeriodSetting {
  return {
    buildingId,
    period,
    ...defaultChargePeriod(period),
    dueDate: null,
    isSaved: false,
  };
}

export async function getBillingPeriodSetting(buildingId: number, period: string): Promise<BillingPeriodSetting> {
  const { data, error } = await createClient()
    .from("billing_period_settings")
    .select("building_id, period, charge_start_date, charge_end_date, due_date")
    .eq("building_id", buildingId)
    .eq("period", period)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data
    ? rowToPeriodSetting(data as BillingPeriodSettingDbRow)
    : defaultBillingPeriodSetting(buildingId, period);
}

export interface SaveBillingPeriodSettingPayload {
  buildingId: number;
  period: string;
  chargeStartDate: string;
  chargeEndDate: string;
  dueDate: string | null;
}

export async function saveBillingPeriodSetting(
  payload: SaveBillingPeriodSettingPayload,
): Promise<BillingPeriodSetting> {
  const { data, error } = await createClient()
    .from("billing_period_settings")
    .upsert({
      building_id: payload.buildingId,
      period: payload.period,
      charge_start_date: payload.chargeStartDate,
      charge_end_date: payload.chargeEndDate,
      due_date: payload.dueDate,
    }, { onConflict: "building_id,period" })
    .select("building_id, period, charge_start_date, charge_end_date, due_date")
    .single();
  if (error) throw new Error(error.message);
  return rowToPeriodSetting(data as BillingPeriodSettingDbRow);
}
