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
  deposit?: number | null;
  monthlyRent?: number | null;
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
  deposit?: number;
  monthlyRent?: number;
  status?: OccupancyStatus;
  memo?: string;
}

type OccupancyRow = {
  id: number; unit_id: number; tenant_name: string | null; payer_name: string | null;
  phone: string | null; resident_count: number | null; vehicle_no: string | null;
  move_in_date: string | null; move_out_date: string | null;
  deposit: unknown; monthly_rent: unknown; status: OccupancyStatus; memo: string | null;
};

const rowToOccupancy = (r: OccupancyRow): Occupancy => ({
  id: r.id, unitId: r.unit_id, tenantName: r.tenant_name, payerName: r.payer_name,
  phone: r.phone, residentCount: r.resident_count, vehicleNo: r.vehicle_no,
  moveInDate: r.move_in_date, moveOutDate: r.move_out_date,
  deposit: r.deposit != null ? Number(r.deposit) : null, monthlyRent: r.monthly_rent != null ? Number(r.monthly_rent) : null,
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
  const { data, error } = await createClient().from("occupancies").select("*").eq("unit_id", unitId).is("deleted_at", null).order("id");
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

// 소프트삭제: 물리 DELETE 대신 deleted_at 세팅(입주 이력 보존)
export async function deleteOccupancy(id: number): Promise<void> {
  const { error } = await createClient().from("occupancies").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
