// hooks/reactquery/attachments/apis.ts
import { createClient } from "@/lib/supabase/client";

export interface Attachment {
  id: number; orgId: number; entityType: string; entityId: number;
  kind: string; fileUrl: string; fileName: string; createdAt: string;
}

type AttachmentRow = {
  id: number; org_id: number; entity_type: string; entity_id: number;
  kind: string; file_url: string; file_name: string; created_at: string;
};

const toAtt = (r: AttachmentRow): Attachment => ({
  id: r.id, orgId: r.org_id, entityType: r.entity_type, entityId: r.entity_id,
  kind: r.kind, fileUrl: r.file_url, fileName: r.file_name, createdAt: r.created_at,
});

const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "application/pdf",
]);

export async function uploadAttachment(params: {
  entityType: string; entityId: number; orgId: number; kind: string; file: File;
}): Promise<Attachment> {
  const { entityType, entityId, orgId, kind, file } = params;
  if (!ATTACHMENT_MIME_TYPES.has(file.type)) {
    throw new Error("이미지 또는 PDF 파일만 업로드할 수 있습니다.");
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new Error("첨부 파일은 10MB 이하여야 합니다.");
  }
  const sb = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${orgId}/${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`;
  const { error: upErr } = await sb.storage.from("attachments").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await sb.from("attachments").insert({
    org_id: orgId, entity_type: entityType, entity_id: entityId, kind, file_url: path, file_name: file.name,
  }).select().single();
  if (error) {
    await sb.storage.from("attachments").remove([path]);
    throw new Error(error.message);
  }
  return toAtt(data);
}

export async function listAttachments(entityType: string, entityId: number): Promise<Attachment[]> {
  const { data, error } = await createClient()
    .from("attachments").select("*").eq("entity_type", entityType).eq("entity_id", entityId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAtt);
}

export async function listAttachmentsByEntities(entityType: string, ids: number[]): Promise<Attachment[]> {
  if (ids.length === 0) return [];
  const { data, error } = await createClient()
    .from("attachments").select("*").eq("entity_type", entityType).in("entity_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAtt);
}

export async function deleteAttachment(params: { id: number; path: string }): Promise<void> {
  const sb = createClient();
  const { error: sErr } = await sb.storage.from("attachments").remove([params.path]);
  if (sErr) throw new Error(sErr.message);
  const { error } = await sb.from("attachments").delete().eq("id", params.id);
  if (error) throw new Error(error.message);
}

export async function attachmentSignedUrl(path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await createClient().storage.from("attachments").createSignedUrl(path, expiresInSec);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
