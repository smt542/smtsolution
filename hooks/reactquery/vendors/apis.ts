import { createClient } from "@/lib/supabase/client";

export interface Vendor { id: number; orgId: number; name: string; phone?: string | null; bankAccount?: string | null; memo?: string | null; categoryId?: number | null; }
export interface VendorInput { orgId: number; name: string; phone?: string; bankAccount?: string; memo?: string; categoryId?: number | null; }

export interface VendorAttachment { id: number; orgId: number; entityType: string; entityId: number; kind: string; fileUrl: string; fileName: string; createdAt: string; }

type VendorRow = {
  id: number; org_id: number; name: string; phone: string | null;
  bank_account: string | null; memo: string | null; category_id: number | null;
};
type VendorAttachmentRow = {
  id: number; org_id: number; entity_type: string; entity_id: number;
  kind: string; file_url: string; file_name: string; created_at: string;
};

const rowToVendor = (r: VendorRow): Vendor => ({ id: r.id, orgId: r.org_id, name: r.name, phone: r.phone, bankAccount: r.bank_account, memo: r.memo, categoryId: r.category_id });
const rowToAttachment = (r: VendorAttachmentRow): VendorAttachment => ({ id: r.id, orgId: r.org_id, entityType: r.entity_type, entityId: r.entity_id, kind: r.kind, fileUrl: r.file_url, fileName: r.file_name, createdAt: r.created_at });

function inputToRow(i: Partial<VendorInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("name", i.name); set("phone", i.phone);
  set("bank_account", i.bankAccount); set("memo", i.memo); set("category_id", i.categoryId);
  return r;
}

export async function listVendors(categoryId?: number, search?: string): Promise<Vendor[]> {
  const sb = createClient();
  let q = sb.from("vendors").select("*");
  if (categoryId !== undefined) q = q.eq("category_id", categoryId);
  if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,memo.ilike.%${search}%`);
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

export async function uploadVendorAttachment({ vendorId, orgId, file }: { vendorId: number; orgId: number; file: File }): Promise<VendorAttachment> {
  const sb = createClient();
  const path = `${orgId}/vendor/${vendorId}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await sb.storage.from("attachments").upload(path, file);
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await sb.from("attachments")
    .insert({ org_id: orgId, entity_type: "vendor", entity_id: vendorId, kind: "contract", file_url: path, file_name: file.name })
    .select().single();
  if (error) { await sb.storage.from("attachments").remove([path]); throw new Error(error.message); }
  return rowToAttachment(data);
}

export async function listVendorAttachments(vendorId: number): Promise<VendorAttachment[]> {
  const { data, error } = await createClient().from("attachments").select("*").eq("entity_type", "vendor").eq("entity_id", vendorId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAttachment);
}

export async function deleteVendorAttachment({ id, path }: { id: number; path: string; vendorId: number }): Promise<void> {
  const sb = createClient();
  const { error: storageError } = await sb.storage.from("attachments").remove([path]);
  if (storageError) throw new Error(storageError.message);
  const { error } = await sb.from("attachments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getAttachmentSignedUrl(path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await createClient().storage.from("attachments").createSignedUrl(path, expiresInSec);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
