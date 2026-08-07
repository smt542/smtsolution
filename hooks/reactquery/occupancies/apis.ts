import { createClient } from "@/lib/supabase/client";

export type OccupancyStatus = "occupied" | "vacant" | "moving_out";

export interface Occupancy {
  id: number;
  unitId: number;
  tenantName?: string | null;
  payerName?: string | null;
  phone?: string | null;
  residentCount?: number | null;
  vehicleNo?: string | null;
  moveInDate?: string | null;
  moveOutDate?: string | null;
  deposit?: string | null;
  monthlyRent?: string | null;
  status: OccupancyStatus;
  memo?: string | null;
}

export interface OccupancyInput {
  unitId: number;
  tenantName?: string;
  payerName?: string;
  phone?: string;
  residentCount?: number;
  vehicleNo?: string;
  moveInDate?: string;
  moveOutDate?: string;
  deposit?: string;
  monthlyRent?: string;
  status?: OccupancyStatus;
  memo?: string;
}

const rowToOccupancy = (r: any): Occupancy => ({
  id: r.id, unitId: r.unit_id, tenantName: r.tenant_name, payerName: r.payer_name,
  phone: r.phone, residentCount: r.resident_count, vehicleNo: r.vehicle_no,
  moveInDate: r.move_in_date, moveOutDate: r.move_out_date,
  deposit: r.deposit, monthlyRent: r.monthly_rent,
  status: r.status, memo: r.memo,
});

function inputToRow(i: Partial<OccupancyInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("unit_id", i.unitId); set("tenant_name", i.tenantName); set("payer_name", i.payerName);
  set("phone", i.phone); set("resident_count", i.residentCount); set("vehicle_no", i.vehicleNo);
  set("move_in_date", i.moveInDate); set("move_out_date", i.moveOutDate);
  set("deposit", i.deposit); set("monthly_rent", i.monthlyRent);
  set("status", i.status); set("memo", i.memo);
  return r;
}

export async function listOccupancies(unitId: number): Promise<Occupancy[]> {
  const { data, error } = await createClient().from("occupancies").select("*").eq("unit_id", unitId).order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOccupancy);
}

export async function getOccupancy(id: number): Promise<Occupancy> {
  const { data, error } = await createClient().from("occupancies").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return rowToOccupancy(data);
}

export async function createOccupancy(input: OccupancyInput): Promise<Occupancy> {
  const { data, error } = await createClient().from("occupancies").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message);
  return rowToOccupancy(data);
}

export async function updateOccupancy(id: number, input: Partial<OccupancyInput>): Promise<Occupancy> {
  const { data, error } = await createClient().from("occupancies").update(inputToRow(input)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToOccupancy(data);
}

export async function deleteOccupancy(id: number): Promise<void> {
  const { error } = await createClient().from("occupancies").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
