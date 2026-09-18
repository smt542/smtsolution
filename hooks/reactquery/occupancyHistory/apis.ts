import { createClient } from "@/lib/supabase/client";
export interface OccupancyHistory {
  id: number; unitId: number; tenantName: string | null;
  phone: string | null; phone2: string | null; phone3: string | null;
  moveInDate: string | null; moveOutDate: string | null; roomTypeLabel: string | null;
}
export const toHistory = (r: {
  id:number; unit_id:number; tenant_name:string|null;
  phone:string|null; phone2:string|null; phone3:string|null;
  move_in_date:string|null; move_out_date:string|null; room_type_label:string|null;
}): OccupancyHistory => ({
  id: r.id, unitId: r.unit_id, tenantName: r.tenant_name,
  phone: r.phone, phone2: r.phone2, phone3: r.phone3,
  moveInDate: r.move_in_date, moveOutDate: r.move_out_date, roomTypeLabel: r.room_type_label,
});
export async function listHistoryByUnit(unitId: number): Promise<OccupancyHistory[]> {
  const { data, error } = await createClient().rpc("list_occupancy_history", { p_unit_id: unitId });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toHistory);
}
