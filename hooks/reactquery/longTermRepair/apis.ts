import { createClient } from "@/lib/supabase/client";

export interface LongTermRepair {
  id: number;
  orgId: number;
  buildingId: number;
  workName: string;
  workDate: string | null;
  amount: number | null;
  memo: string | null;
}

export interface LongTermRepairInput {
  orgId: number;
  buildingId: number;
  workName: string;
  workDate?: string | null;
  amount?: number | null;
  memo?: string | null;
}

export interface RepairAttachment {
  id: number;
  orgId: number;
  entityType: string;
  entityId: number;
  kind: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
}

type LongTermRepairRow = {
  id: number; org_id: number; building_id: number; work_name: string;
  work_date: string | null; amount: number | null; memo: string | null;
};

type RepairAttachmentRow = {
  id: number; org_id: number; entity_type: string; entity_id: number;
  kind: string; file_url: string; file_name: string; created_at: string;
};

const toRepair = (r: LongTermRepairRow): LongTermRepair => ({
  id: r.id,
  orgId: r.org_id,
  buildingId: r.building_id,
  workName: r.work_name,
  workDate: r.work_date,
  amount: r.amount,
  memo: r.memo,
});

const toAtt = (r: RepairAttachmentRow): RepairAttachment => ({
  id: r.id,
  orgId: r.org_id,
  entityType: r.entity_type,
  entityId: r.entity_id,
  kind: r.kind,
  fileUrl: r.file_url,
  fileName: r.file_name,
  createdAt: r.created_at,
});

function inputToRow(i: Partial<LongTermRepairInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) r[k] = v;
  };
  set("org_id", i.orgId);
  set("building_id", i.buildingId);
  set("work_name", i.workName);
  set("work_date", i.workDate);
  set("amount", i.amount);
  set("memo", i.memo);
  return r;
}

export async function listRepairsByBuilding(
  buildingId: number
): Promise<LongTermRepair[]> {
  const { data, error } = await createClient()
    .from("long_term_repair_history")
    .select("*")
    .eq("building_id", buildingId)
    .is("deleted_at", null)
    .order("work_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRepair);
}

export async function createRepair(
  input: LongTermRepairInput
): Promise<LongTermRepair> {
  const { data, error } = await createClient()
    .from("long_term_repair_history")
    .insert(inputToRow(input))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toRepair(data);
}

export async function updateRepair(
  id: number,
  input: Partial<LongTermRepairInput>
): Promise<LongTermRepair> {
  const { data, error } = await createClient()
    .from("long_term_repair_history")
    .update(inputToRow(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toRepair(data);
}

export async function deleteRepair(id: number): Promise<void> {
  const { error } = await createClient()
    .from("long_term_repair_history")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadRepairAttachment({
  repairId,
  orgId,
  file,
}: {
  repairId: number;
  orgId: number;
  file: File;
}): Promise<RepairAttachment> {
  const sb = createClient();
  const path = `${orgId}/long_term_repair/${repairId}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await sb
    .storage.from("attachments")
    .upload(path, file);
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await sb
    .from("attachments")
    .insert({
      org_id: orgId,
      entity_type: "long_term_repair",
      entity_id: repairId,
      kind: "repair",
      file_url: path,
      file_name: file.name,
    })
    .select()
    .single();
  if (error) {
    await sb.storage.from("attachments").remove([path]);
    throw new Error(error.message);
  }
  return toAtt(data);
}

export async function listRepairAttachments(
  repairId: number
): Promise<RepairAttachment[]> {
  const { data, error } = await createClient()
    .from("attachments")
    .select("*")
    .eq("entity_type", "long_term_repair")
    .eq("entity_id", repairId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAtt);
}

export async function deleteRepairAttachment({
  id,
  path,
}: {
  id: number;
  path: string;
}): Promise<void> {
  const sb = createClient();
  const { error: sErr } = await sb.storage.from("attachments").remove([path]);
  if (sErr) throw new Error(sErr.message);
  const { error } = await sb.from("attachments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getRepairAttachmentSignedUrl(
  path: string,
  expiresInSec = 3600
): Promise<string> {
  const { data, error } = await createClient()
    .storage.from("attachments")
    .createSignedUrl(path, expiresInSec);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
