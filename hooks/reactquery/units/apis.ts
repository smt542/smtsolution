import { createClient } from "@/lib/supabase/client";

export interface Unit {
  id: number;
  buildingId: number;
  unitNo: string;
  dong?: string | null;
  areaPyeong?: string | null;
  roomCount?: number | null;
  elecCustomerNo?: string | null;
  elecMeterNo?: string | null;
  waterCustomerNo?: string | null;
  memo?: string | null;
}

export interface UnitInput {
  buildingId: number;
  unitNo: string;
  dong?: string;
  areaPyeong?: string;
  roomCount?: number;
  elecCustomerNo?: string;
  elecMeterNo?: string;
  waterCustomerNo?: string;
  memo?: string;
}

const rowToUnit = (r: any): Unit => ({
  id: r.id, buildingId: r.building_id, unitNo: r.unit_no, dong: r.dong,
  areaPyeong: r.area_pyeong, roomCount: r.room_count,
  elecCustomerNo: r.elec_customer_no, elecMeterNo: r.elec_meter_no,
  waterCustomerNo: r.water_customer_no, memo: r.memo,
});

function inputToRow(i: Partial<UnitInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("building_id", i.buildingId); set("unit_no", i.unitNo); set("dong", i.dong);
  set("area_pyeong", i.areaPyeong); set("room_count", i.roomCount);
  set("elec_customer_no", i.elecCustomerNo); set("elec_meter_no", i.elecMeterNo);
  set("water_customer_no", i.waterCustomerNo); set("memo", i.memo);
  return r;
}

export async function listUnits(buildingId: number): Promise<Unit[]> {
  const { data, error } = await createClient().from("units").select("*").eq("building_id", buildingId).order("unit_no");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToUnit);
}

export async function getUnit(id: number): Promise<Unit> {
  const { data, error } = await createClient().from("units").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return rowToUnit(data);
}

export async function createUnit(input: UnitInput): Promise<Unit> {
  const { data, error } = await createClient().from("units").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message);
  return rowToUnit(data);
}

export async function updateUnit(id: number, input: Partial<UnitInput>): Promise<Unit> {
  const { data, error } = await createClient().from("units").update(inputToRow(input)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToUnit(data);
}

export async function deleteUnit(id: number): Promise<void> {
  const { error } = await createClient().from("units").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
