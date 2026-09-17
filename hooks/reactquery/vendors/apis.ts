import { createClient } from "@/lib/supabase/client";

export interface Vendor { id: number; orgId: number; name: string; manager?: string | null; phone?: string | null; bankAccount?: string | null; memo?: string | null; categoryId?: number | null; }
export interface VendorInput { orgId: number; name: string; manager?: string | null; phone?: string | null; bankAccount?: string | null; memo?: string | null; categoryId?: number | null; }

type VendorRow = {
  id: number; org_id: number; name: string; manager: string | null; phone: string | null;
  bank_account: string | null; memo: string | null; category_id: number | null;
};
const rowToVendor = (r: VendorRow): Vendor => ({ id: r.id, orgId: r.org_id, name: r.name, manager: r.manager, phone: r.phone, bankAccount: r.bank_account, memo: r.memo, categoryId: r.category_id });

function inputToRow(i: Partial<VendorInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("name", i.name); set("manager", i.manager); set("phone", i.phone);
  set("bank_account", i.bankAccount); set("memo", i.memo); set("category_id", i.categoryId);
  return r;
}

export async function listVendors(categoryId?: number, search?: string): Promise<Vendor[]> {
  const sb = createClient();
  let q = sb.from("vendors").select("*");
  if (categoryId !== undefined) q = q.eq("category_id", categoryId);
  if (search) q = q.or(`name.ilike.%${search}%,manager.ilike.%${search}%,phone.ilike.%${search}%,memo.ilike.%${search}%`);
  const { data, error } = await q.order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToVendor);
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  const { data, error } = await createClient().from("vendors").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message);
  return rowToVendor(data);
}

export async function updateVendor(id: number, input: Partial<VendorInput>): Promise<Vendor> {
  const { data, error } = await createClient().from("vendors").update(inputToRow(input)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToVendor(data);
}

export async function deleteVendor(id: number): Promise<void> {
  const { error } = await createClient().from("vendors").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
