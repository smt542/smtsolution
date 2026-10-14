import { createClient } from "@/lib/supabase/client";
import type { BillingFlatRow } from "@/lib/billing/pivot";
import { defaultChargePeriod } from "@/lib/billing/period";

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

/**
 * 빌라자료추가·전체자료추가: 이 건물의 지난 자료 중 가장 최근 값을 이번 달로 가져온다.
 * - 금액: 이번 달에 있는 세대·이월 항목마다 저장된 값이 있는 가장 최근 달의 값(billing_latest_charges).
 * - 부과기준일·납기일: 설정해 둔 가장 최근 달(이번 달 이전, 없으면 이후 포함)을 이번 달로 옮긴다.
 * 가져올 값이 없는 칸·설정은 이번 달 값을 그대로 둔다(0이나 기본값으로 덮어쓰지 않는다).
 */
export async function copyPreviousBilling(
  buildingId: number,
  period: string,
): Promise<CopyPreviousBillingResult> {
  const [latestCharges, currentRows] = await Promise.all([
    listLatestCharges(buildingId, period),
    listBilling(buildingId, period),
  ]);
  const latestByCell = new Map(latestCharges.map((row) => [`${row.unitId}:${row.feeItemId}`, row]));
  // 필수 공과금 항목(전기·수도료·가스)은 저장값이 없으면 그 달 산정값이 기본값이라(마이그 0193)
  // 지난 금액을 저장해 고정하지 않는다.
  const charges = currentRows
    .filter((current) => current.carryOver && !current.isRequired)
    .flatMap((current) => {
      const latest = latestByCell.get(`${current.unitId}:${current.feeItemId}`);
      return latest
        ? [{
            unitId: current.unitId,
            feeItemId: current.feeItemId,
            charged: latest.charged,
            amount: latest.amount,
            occupancyId: current.occupancyId,
          }]
        : [];
    });
  const unitIds = [...new Set(charges.map((charge) => charge.unitId))];
  if (charges.length > 0) {
    await saveBillingCharges({ buildingId, period, charges, notes: [] });
  }

  const [currentSetting, chargeSource, dueSource] = await Promise.all([
    getBillingPeriodSetting(buildingId, period),
    latestPeriodSetting(buildingId, period, "charge_start_date"),
    latestPeriodSetting(buildingId, period, "due_date"),
  ]);
  if (chargeSource || dueSource) {
    const chargeMonths = chargeSource ? monthsBetween(chargeSource.period, period) : 0;
    await saveBillingPeriodSetting({
      buildingId,
      period,
      chargeStartDate: chargeSource ? carryDate(chargeSource.chargeStartDate, chargeMonths) : currentSetting.chargeStartDate,
      chargeEndDate: chargeSource ? carryDate(chargeSource.chargeEndDate, chargeMonths) : currentSetting.chargeEndDate,
      dueDate: dueSource?.dueDate
        ? carryDate(dueSource.dueDate, monthsBetween(dueSource.period, period))
        : currentSetting.dueDate,
    });
  }
  return { unitCount: unitIds.length, chargeCount: charges.length };
}

interface LatestCharge { unitId: number; feeItemId: number; charged: boolean; amount: number; }

/** 세대·항목별 「저장된 값이 있는 가장 최근 달」의 값(이번 달 이전). */
async function listLatestCharges(buildingId: number, period: string): Promise<LatestCharge[]> {
  const { data, error } = await createClient().rpc("billing_latest_charges", {
    p_building_id: buildingId,
    p_period: period,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { unit_id: number; fee_item_id: number; charged: boolean; amount: number }[])
    .map((row) => ({ unitId: row.unit_id, feeItemId: row.fee_item_id, charged: row.charged, amount: row.amount }));
}

interface PeriodSettingSource {
  period: string;
  chargeStartDate: string;
  chargeEndDate: string;
  dueDate: string | null;
}

/**
 * 이월 기준 달: column 값이 있는 이번 달 이전의 가장 최근 달(보통 전월).
 * 이전 달에 하나도 없으면 가장 최신 달(이번 달 이후 포함, 이번 달 제외).
 */
async function latestPeriodSetting(
  buildingId: number,
  period: string,
  column: "charge_start_date" | "due_date",
): Promise<PeriodSettingSource | null> {
  const query = () => createClient()
    .from("billing_period_settings")
    .select("period, charge_start_date, charge_end_date, due_date")
    .eq("building_id", buildingId)
    .neq("period", period)
    .not(column, "is", null)
    .order("period", { ascending: false })
    .limit(1);
  let result = await query().lt("period", period).maybeSingle();
  if (!result.error && !result.data) result = await query().maybeSingle();
  if (result.error) throw new Error(result.error.message);
  const row = result.data as BillingPeriodSettingDbRow | null;
  return row
    ? { period: row.period, chargeStartDate: row.charge_start_date, chargeEndDate: row.charge_end_date, dueDate: row.due_date }
    : null;
}

function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function addMonths(year: number, month: number, months: number): [number, number] {
  const index = year * 12 + (month - 1) + months;
  return [Math.floor(index / 12), (index % 12) + 1];
}

/**
 * 날짜 이월: 기준 달과 같은 날짜를 months 개월 옮긴다(짧은 달은 말일로 맞춤).
 * 기준 날짜가 그 달 말일이었으면 옮긴 달도 말일(2/28 → 3/31).
 */
function carryDate(value: string, months: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const [nextYear, nextMonth] = addMonths(year, month, months);
  const lastDay = lastDayOfMonth(nextYear, nextMonth);
  const nextDay = day === lastDayOfMonth(year, month) ? lastDay : Math.min(day, lastDay);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
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
