import { createClient } from "@/lib/supabase/client";
export type MeterUtility = "water" | "elec" | "elec_shared" | "gas" | "kepco";
export interface UnitMeter { id: number; unitId: number; utility: MeterUtility; meterNo: string | null; customerNo: string | null; }
export const toUnitMeter = (r: { id:number; unit_id:number; utility:MeterUtility; meter_no:string|null; customer_no:string|null }): UnitMeter =>
  ({ id: r.id, unitId: r.unit_id, utility: r.utility, meterNo: r.meter_no, customerNo: r.customer_no });
export async function listMetersByUnit(unitId: number): Promise<UnitMeter[]> {
  const { data, error } = await createClient().from("unit_meters").select("*").eq("unit_id", unitId).order("utility");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toUnitMeter);
}
