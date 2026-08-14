import { createClient } from "@/lib/supabase/client";
export type UnitUsageType = "residential" | "commercial";
export interface Unit {
  id: number; buildingId: number; unitNo: string; dong: string | null; areaPyeong: number | null;
  roomCount: number | null; floor: number | null; usageType: UnitUsageType; memo: string | null;
}
export const rowToUnit = (r: {
  id:number; building_id:number; unit_no:string; dong:string|null; area_pyeong:number|null;
  room_count:number|null; floor:number|null; usage_type:UnitUsageType|null; memo:string|null;
}): Unit => ({
  id: r.id, buildingId: r.building_id, unitNo: r.unit_no, dong: r.dong, areaPyeong: r.area_pyeong,
  roomCount: r.room_count, floor: r.floor ?? null, usageType: r.usage_type ?? "residential", memo: r.memo,
});
export async function getUnit(id: number): Promise<Unit> {
  const { data, error } = await createClient().from("units").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return rowToUnit(data);
}
export async function listUnits(buildingId: number): Promise<Unit[]> {
  const { data, error } = await createClient().from("units").select("*").eq("building_id", buildingId).is("deleted_at", null).order("unit_no");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToUnit);
}
