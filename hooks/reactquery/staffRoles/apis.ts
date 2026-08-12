import { createClient } from "@/lib/supabase/client";

export interface StaffRole { id: number; orgId: number; label: string; sortOrder: number; }
export interface StaffRoleInput { orgId: number; label: string; sortOrder?: number; }

type StaffRoleRow = { id: number; org_id: number; label: string; sort_order: number };

const rowTo = (r: StaffRoleRow): StaffRole => ({ id: r.id, orgId: r.org_id, label: r.label, sortOrder: r.sort_order });

export async function listStaffRoles(): Promise<StaffRole[]> {
  const { data, error } = await createClient()
    .from("staff_roles").select("*").is("deleted_at", null).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowTo);
}
export async function createStaffRole(input: StaffRoleInput): Promise<StaffRole> {
  const { data, error } = await createClient().from("staff_roles")
    .insert({ org_id: input.orgId, label: input.label, sort_order: input.sortOrder ?? 0 })
    .select().single();
  if (error) throw new Error(error.message);
  return rowTo(data);
}
export async function renameStaffRole(id: number, label: string): Promise<void> {
  const { error } = await createClient().from("staff_roles").update({ label }).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteStaffRole(id: number): Promise<void> {
  const { error } = await createClient().from("staff_roles")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
