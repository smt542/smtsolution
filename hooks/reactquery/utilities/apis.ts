import { createClient } from "@/lib/supabase/client";

export const UTILITY_TYPES = ["water", "electricity", "gas"] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

/** DB(unit_meters·meter_readings)는 'elec'을 쓴다(UI는 electricity). */
export function dbUtility(type: UtilityType): "water" | "elec" | "gas" {
  return type === "electricity" ? "elec" : type;
}

export interface UtilityUnitRow {
  unitId: number;
  unitNo: string;
  dong: string | null;
  occupancyId: number | null;
  tenantName: string | null;
  occupancyStatus: "occupied" | "vacant" | "moving_out" | null;
  moveInDate: string | null;
  customerNumber: string | null;
  meterNumber: string | null;
  previousReading: number | null;
  currentReading: number | null;
  usage: number | null;
  unitPrice: number | null;
  resolvedUnitPrice: number | null;
  automaticCharge: number | null;
  manualCharge: number | null;
  note: string | null;
  processedAt: string | null;
  discountType: string | null;
  discountAmount: number | null;
}

interface UtilityRowRpc {
  unit_id: number;
  unit_no: string;
  dong: string | null;
  occupancy_id: number | null;
  tenant_name: string | null;
  occupancy_status: UtilityUnitRow["occupancyStatus"];
  move_in_date: string | null;
  customer_no: string | null;
  meter_no: string | null;
  previous_reading: number | null;
  current_reading: number | null;
  usage: number | null;
  unit_price: number | null;
  calc_charge: number | null;
  discount_amount: number | null;
  manual_charge: number | null;
  note: string | null;
  processed_at: string | null;
  discount_type: string | null;
  resolved_unit_price: number | null;
}

function rpcToUtilityRow(r: UtilityRowRpc): UtilityUnitRow {
  return {
    unitId: r.unit_id,
    unitNo: r.unit_no,
    dong: r.dong,
    occupancyId: r.occupancy_id,
    tenantName: r.tenant_name,
    occupancyStatus: r.occupancy_status,
    moveInDate: r.move_in_date,
    customerNumber: r.customer_no,
    meterNumber: r.meter_no,
    previousReading: r.previous_reading,
    currentReading: r.current_reading,
    usage: r.usage,
    unitPrice: r.unit_price,
    resolvedUnitPrice: r.resolved_unit_price,
    automaticCharge: r.calc_charge,
    manualCharge: r.manual_charge,
    note: r.note,
    processedAt: r.processed_at,
    discountType: r.discount_type,
    discountAmount: r.discount_amount,
  };
}

/** period: 'YYYY-MM-01'(월1일). */
export async function listUtilityRows(
  buildingId: number,
  utilityType: UtilityType,
  period: string,
): Promise<UtilityUnitRow[]> {
  const { data, error } = await createClient().rpc("list_utility_rows", {
    p_building_id: buildingId,
    p_utility: dbUtility(utilityType),
    p_period: period,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as UtilityRowRpc[]).map(rpcToUtilityRow);
}

export interface SaveMeterReadingsInput {
  buildingId: number;
  utilityType: UtilityType;
  period: string;
  rows: { unit_id: number; current_reading?: string; manual_charge: string; note: string }[];
}
export interface SaveMeterReadingsResult {
  saved: number;
  period: string;
  totalCalc?: number;
}

export async function saveMeterReadings(
  input: SaveMeterReadingsInput,
): Promise<SaveMeterReadingsResult> {
  const { data, error } = await createClient().rpc("save_meter_readings", {
    p_building_id: input.buildingId,
    p_utility: dbUtility(input.utilityType),
    p_period: input.period,
    p_rows: input.rows,
  });
  if (error) throw new Error(error.message);
  const d = data as { saved: number; period: string; total_calc?: number };
  return {
    saved: d.saved,
    period: d.period,
    ...(d.total_calc === undefined ? {} : { totalCalc: d.total_calc }),
  };
}

interface UtilityPriceRpc {
  customer_number_id: number;
  customer_no: string;
  holder_name: string | null;
  sort_order: number;
  unit_price: number | null;
}

export interface UtilityPriceRow {
  customerNumberId: number;
  customerNo: string;
  holderName: string | null;
  sortOrder: number;
  unitPrice: number | null;
}

export async function listUtilityPrices(
  buildingId: number,
  utilityType: UtilityType,
): Promise<UtilityPriceRow[]> {
  const { data, error } = await createClient().rpc("list_utility_prices", {
    p_building_id: buildingId,
    p_utility: dbUtility(utilityType),
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as UtilityPriceRpc[]).map((row) => ({
    customerNumberId: row.customer_number_id,
    customerNo: row.customer_no,
    holderName: row.holder_name,
    sortOrder: row.sort_order,
    unitPrice: row.unit_price,
  }));
}

export interface SaveUtilityUnitPricesInput {
  buildingId: number;
  utilityType: UtilityType;
  prices: { customer_number_id: number; unit_price: number }[];
}

export interface SaveUtilityUnitPricesResult {
  saved: number;
}

export async function saveUtilityUnitPrices(
  input: SaveUtilityUnitPricesInput,
): Promise<SaveUtilityUnitPricesResult> {
  const { data, error } = await createClient().rpc("save_utility_unit_prices", {
    p_building_id: input.buildingId,
    p_utility: dbUtility(input.utilityType),
    p_prices: input.prices,
  });
  if (error) throw new Error(error.message);
  return { saved: (data as { saved: number }).saved };
}

export type ScopedUsageType = "residential" | "commercial";

export interface ScopedPriceRow {
  usage_type: ScopedUsageType;
  floor: number | null;
  unit_price: number;
}

export async function listScopedPrices(
  buildingId: number,
  utilityType: UtilityType,
): Promise<ScopedPriceRow[]> {
  const { data, error } = await createClient()
    .from("utility_scoped_prices")
    .select("usage_type, floor, unit_price")
    .eq("building_id", buildingId)
    .eq("utility", dbUtility(utilityType));
  if (error) throw new Error(error.message);
  return ((data ?? []) as ScopedPriceRow[]).map((row) => ({
    usage_type: row.usage_type,
    floor: row.floor,
    unit_price: Number(row.unit_price),
  }));
}

export interface SaveScopedPricesResult {
  saved: number;
}

export async function saveScopedPrices(
  buildingId: number,
  utilityType: UtilityType,
  rows: ScopedPriceRow[],
): Promise<SaveScopedPricesResult> {
  if (rows.length === 0) return { saved: 0 };

  const { error } = await createClient()
    .from("utility_scoped_prices")
    .upsert(
      rows.map((row) => ({
        building_id: buildingId,
        utility: dbUtility(utilityType),
        usage_type: row.usage_type,
        floor: row.floor,
        unit_price: row.unit_price,
      })),
      { onConflict: "building_id,utility,usage_type,floor" },
    );
  if (error) throw new Error(error.message);
  return { saved: rows.length };
}

export interface SaveScopedPricesInput {
  buildingId: number;
  utilityType: UtilityType;
  rows: ScopedPriceRow[];
}

export interface FixedUsageRow {
  unitId: number;
  fixedUsage: number;
}

interface FixedUsageDbRow {
  unit_id: number;
  fixed_usage: number | string;
}

export async function listFixedUsages(
  buildingId: number,
  utilityType: UtilityType,
): Promise<FixedUsageRow[]> {
  const { data, error } = await createClient()
    .from("unit_meters")
    .select("unit_id, fixed_usage, units!inner(building_id)")
    .eq("utility", dbUtility(utilityType))
    .eq("units.building_id", buildingId)
    .is("units.deleted_at", null)
    .not("fixed_usage", "is", null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FixedUsageDbRow[]).map((row) => ({
    unitId: row.unit_id,
    fixedUsage: Number(row.fixed_usage),
  }));
}

export interface SetFixedUsageInput {
  buildingId: number;
  unitId: number;
  utilityType: UtilityType;
  fixedUsage: number;
}

export async function setFixedUsage(input: SetFixedUsageInput): Promise<void> {
  const { error } = await createClient()
    .from("unit_meters")
    .upsert(
      {
        unit_id: input.unitId,
        utility: dbUtility(input.utilityType),
        fixed_usage: input.fixedUsage,
      },
      { onConflict: "unit_id,utility" },
    );
  if (error) throw new Error(error.message);
}

export interface ClearFixedUsageInput {
  buildingId: number;
  unitId: number;
  utilityType: UtilityType;
}

export async function clearFixedUsage(input: ClearFixedUsageInput): Promise<void> {
  const { error } = await createClient()
    .from("unit_meters")
    .update({ fixed_usage: null })
    .eq("unit_id", input.unitId)
    .eq("utility", dbUtility(input.utilityType));
  if (error) throw new Error(error.message);
}

export interface ConfirmUtilitiesInput {
  buildingId: number;
  utilityType: UtilityType;
  period: string;
}

export interface ConfirmUtilitiesResult {
  unitCount: number;
  total: number;
}

export async function confirmUtilities(
  input: ConfirmUtilitiesInput,
): Promise<ConfirmUtilitiesResult> {
  const { data, error } = await createClient().rpc("confirm_utilities", {
    p_building_id: input.buildingId,
    p_utility: dbUtility(input.utilityType),
    p_period: input.period,
  });
  if (error) throw new Error(error.message);
  const result = data as { unit_count: number; total: number };
  return { unitCount: result.unit_count, total: result.total };
}

interface UtilityConfirmationRpc {
  confirmed_at: string;
  confirmed_by_name: string | null;
  unit_count: number;
  total_amount: number;
  is_dirty: boolean;
}

export interface UtilityConfirmation {
  confirmedAt: string;
  confirmedByName: string | null;
  unitCount: number;
  totalAmount: number;
  isDirty: boolean;
}

export async function getUtilityConfirmation(
  buildingId: number,
  utilityType: UtilityType,
  period: string,
): Promise<UtilityConfirmation | null> {
  const { data, error } = await createClient().rpc("list_utility_confirmation", {
    p_building_id: buildingId,
    p_utility: dbUtility(utilityType),
    p_period: period,
  });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as UtilityConfirmationRpc[])[0];
  return row
    ? {
        confirmedAt: row.confirmed_at,
        confirmedByName: row.confirmed_by_name,
        unitCount: row.unit_count,
        totalAmount: row.total_amount,
        isDirty: row.is_dirty,
      }
    : null;
}

export function ledgerDownloadUrl(
  buildingId: number,
  utilityType: UtilityType,
  period: string,
): string {
  const params = new URLSearchParams({
    buildingId: String(buildingId),
    utility: dbUtility(utilityType),
    period,
  });
  return `/api/utilities/ledger?${params.toString()}`;
}

export type WaterDiscountType = "recipient" | "multichild" | "other";
export interface SaveWaterDiscountInput {
  unitId: number;
  discountType: WaterDiscountType;
  amount: number;
  memo?: string | null;
}

export async function saveWaterDiscount(input: SaveWaterDiscountInput): Promise<void> {
  const { error } = await createClient()
    .from("water_discounts")
    .upsert(
      {
        unit_id: input.unitId,
        discount_type: input.discountType,
        amount: input.amount,
        memo: input.memo ?? null,
      },
      { onConflict: "unit_id" },
    );
  if (error) throw new Error(error.message);
}

export async function deleteWaterDiscount(unitId: number): Promise<void> {
  const { error } = await createClient().from("water_discounts").delete().eq("unit_id", unitId);
  if (error) throw new Error(error.message);
}

export interface MeterHistoryRow {
  period: string;
  charge: number | null;
  unitPrice: number | null;
}

export async function listMeterHistory(
  unitId: number,
  utilityType: UtilityType,
  period: string,
): Promise<MeterHistoryRow[]> {
  const { data, error } = await createClient()
    .from("meter_readings")
    .select("period, manual_charge, calc_charge, unit_price")
    .eq("unit_id", unitId)
    .eq("utility", dbUtility(utilityType))
    .lte("period", period)
    .order("period", { ascending: false })
    .limit(6);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as {
      period: string;
      manual_charge: number | null;
      calc_charge: number | null;
      unit_price: number | null;
    }[]
  ).map((r) => ({
    period: r.period,
    charge: r.manual_charge ?? r.calc_charge,
    unitPrice: r.unit_price,
  }));
}
