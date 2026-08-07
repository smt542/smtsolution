import { createClient } from "@/lib/supabase/client";
export interface Building { id:number; orgId:number; code:string; name:string; address?:string|null;
  typeId?:number|null; ownerName?:string|null; ownerPhone?:string|null; entrancePassword?:string|null;
  managerName?:string|null; meterStaffName?:string|null; cleaningStaffName?:string|null; memo?:string|null; }
export interface BuildingInput { orgId:number; code:string; name:string; address?:string; typeId?:number|null;
  ownerName?:string; ownerPhone?:string; entrancePassword?:string; managerName?:string; meterStaffName?:string; cleaningStaffName?:string; memo?:string; }
const rowToBuilding = (r: any): Building => ({ id:r.id, orgId:r.org_id, code:r.code, name:r.name, address:r.address,
  typeId:r.type_id, ownerName:r.owner_name, ownerPhone:r.owner_phone, entrancePassword:r.entrance_password,
  managerName:r.manager_name, meterStaffName:r.meter_staff_name, cleaningStaffName:r.cleaning_staff_name, memo:r.memo });
function inputToRow(i: Partial<BuildingInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("code", i.code); set("name", i.name); set("address", i.address);
  set("type_id", i.typeId); set("owner_name", i.ownerName); set("owner_phone", i.ownerPhone);
  set("entrance_password", i.entrancePassword); set("manager_name", i.managerName);
  set("meter_staff_name", i.meterStaffName); set("cleaning_staff_name", i.cleaningStaffName); set("memo", i.memo);
  return r;
}

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
export async function getBuilding(id: number): Promise<Building> {
  const { data, error } = await createClient().from("buildings").select("*").eq("id", id).single();
  if (error) throw new Error(error.message); return rowToBuilding(data);
}
export async function updateBuilding(id: number, input: Partial<BuildingInput>): Promise<Building> {
  const { data, error } = await createClient().from("buildings").update(inputToRow(input)).eq("id", id).select().single();
  if (error) throw new Error(error.message); return rowToBuilding(data);
}
export async function deleteBuilding(id: number): Promise<void> {
  const { error } = await createClient().from("buildings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
