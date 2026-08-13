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
  rows: { unit_id: number; current_reading: string; manual_charge: string; note: string }[];
}
export interface SaveMeterReadingsResult {
  saved: number;
  period: string;
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
  const d = data as { saved: number; period: string };
  return { saved: d.saved, period: d.period };
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
  ).map((r) => ({ period: r.period, charge: r.calc_charge ?? r.manual_charge, unitPrice: r.unit_price }));
}
