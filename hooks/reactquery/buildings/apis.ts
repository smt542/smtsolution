import { createClient } from "@/lib/supabase/client";
export interface Building { id:number; orgId:number; code:string; name:string; address?:string|null;
  typeId?:number|null; ownerName?:string|null; ownerPhone?:string|null; entrancePassword?:string|null;
  managerName?:string|null; meterStaffName?:string|null; cleaningStaffName?:string|null; memo?:string|null; }
export interface BuildingInput { orgId:number; code:string; name:string; address?:string; typeId?:number|null;
  ownerName?:string; ownerPhone?:string; entrancePassword?:string; managerName?:string; meterStaffName?:string; cleaningStaffName?:string; memo?:string; }
const rowToBuilding = (r: any): Building => ({ id:r.id, orgId:r.org_id, code:r.code, name:r.name, address:r.address,
  typeId:r.type_id, ownerName:r.owner_name, ownerPhone:r.owner_phone, entrancePassword:r.entrance_password,
  managerName:r.manager_name, meterStaffName:r.meter_staff_name, cleaningStaffName:r.cleaning_staff_name, memo:r.memo });
const inputToRow = (i: BuildingInput) => ({ org_id:i.orgId, code:i.code, name:i.name, address:i.address,
  type_id:i.typeId ?? null, owner_name:i.ownerName, owner_phone:i.ownerPhone, entrance_password:i.entrancePassword,
  manager_name:i.managerName, meter_staff_name:i.meterStaffName, cleaning_staff_name:i.cleaningStaffName, memo:i.memo });

export async function listBuildings(search?: string): Promise<Building[]> {
  const sb = createClient();
  let q = sb.from("buildings").select("*");
  if (search) q = q.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
  const { data, error } = await q.order("code");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToBuilding);
}
export async function createBuilding(input: BuildingInput): Promise<Building> {
  const { data, error } = await createClient().from("buildings").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message); return rowToBuilding(data);
}
export async function updateBuilding(id: number, input: Partial<BuildingInput>): Promise<Building> {
  const { data, error } = await createClient().from("buildings").update(inputToRow(input as BuildingInput)).eq("id", id).select().single();
  if (error) throw new Error(error.message); return rowToBuilding(data);
}
export async function deleteBuilding(id: number): Promise<void> {
  const { error } = await createClient().from("buildings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
