import { createClient } from "@/lib/supabase/client";

export interface VendorCategory { id: number; orgId: number; label: string; sortOrder: number; }
export interface VendorCategoryInput { orgId: number; label: string; sortOrder?: number; }

type VendorCategoryRow = { id: number; org_id: number; label: string; sort_order: number };

const rowToCategory = (r: VendorCategoryRow): VendorCategory => ({ id: r.id, orgId: r.org_id, label: r.label, sortOrder: r.sort_order });

function inputToRow(i: Partial<VendorCategoryInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("label", i.label); set("sort_order", i.sortOrder);
  return r;
}

export async function listVendorCategories(): Promise<VendorCategory[]> {
  const { data, error } = await createClient().from("vendor_categories").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToCategory);
}

export async function createVendorCategory(input: VendorCategoryInput): Promise<VendorCategory> {
  const { data, error } = await createClient().from("vendor_categories").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message);
  return rowToCategory(data);
}

export async function renameVendorCategory(id: number, label: string): Promise<VendorCategory> {
  const { data, error } = await createClient().from("vendor_categories").update({ label }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToCategory(data);
}

export async function deleteVendorCategory(id: number): Promise<void> {
  const { error } = await createClient().from("vendor_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
