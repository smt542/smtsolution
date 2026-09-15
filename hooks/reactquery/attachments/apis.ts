import { createClient } from "@/lib/supabase/client";
import {
  buildAttachmentStoragePath,
  validateAttachmentFile,
  type AttachmentFileType,
} from "@/lib/attachments/policy";
import {
  createPrivateAssetSignedUrl,
  type AttachmentImagePreset,
} from "@/lib/attachments/signedUrl";

const ATTACHMENTS_BUCKET = "attachments";

export interface Attachment {
  id: number;
  orgId: number;
  entityType: string;
  entityId: number;
  kind: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
}

type AttachmentRow = {
  id: number;
  org_id: number;
  entity_type: string;
  entity_id: number;
  kind: string;
  file_url: string;
  file_name: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  created_at: string;
};

const toAttachment = (row: AttachmentRow): Attachment => ({
  id: row.id,
  orgId: row.org_id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  kind: row.kind,
  fileUrl: row.file_url,
  fileName: row.file_name ?? "첨부파일",
  mimeType: row.mime_type ?? null,
  sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
  createdAt: row.created_at,
});

export type AttachmentOrphanedResource = "database_row" | "storage_object";

export class AttachmentConsistencyError extends Error {
  constructor(
    message: string,
    public readonly orphanedResource: AttachmentOrphanedResource,
    public readonly attachmentId: number | null,
    public readonly path: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AttachmentConsistencyError";
  }
}

export interface UploadAttachmentInput {
  entityType: string;
  entityId: number;
  orgId: number;
  kind: string;
  file: File;
  fileType?: AttachmentFileType;
}

export async function uploadAttachment(params: UploadAttachmentInput): Promise<Attachment> {
  const { entityType, entityId, orgId, kind, file, fileType = "any" } = params;
  const validationError = validateAttachmentFile(file, fileType);
  if (validationError) throw new Error(validationError);

  const client = createClient();
  const path = buildAttachmentStoragePath({
    orgId,
    entityType,
    entityId,
    fileName: file.name,
  });
  const { error: uploadError } = await client.storage.from(ATTACHMENTS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error: insertError } = await client.from("attachments").insert({
    org_id: orgId,
    entity_type: entityType,
    entity_id: entityId,
    kind,
    file_url: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  }).select().single();

  if (insertError) {
    const { error: cleanupError } = await client.storage.from(ATTACHMENTS_BUCKET).remove([path]);
    if (cleanupError) {
      throw new AttachmentConsistencyError(
        "첨부 정보 저장과 업로드 파일 정리에 실패했습니다. 관리자 확인이 필요합니다.",
        "storage_object",
        null,
        path,
        { cause: insertError },
      );
    }
    throw new Error(insertError.message);
  }

  return toAttachment(data as AttachmentRow);
}

export interface AttachmentUploadSuccess {
  file: File;
  attachment: Attachment;
}

export interface AttachmentUploadFailure {
  file: File;
  error: unknown;
}

export interface AttachmentUploadBatchResult {
  succeeded: AttachmentUploadSuccess[];
  failed: AttachmentUploadFailure[];
}

export async function uploadAttachments(
  params: Omit<UploadAttachmentInput, "file"> & { files: readonly File[] },
): Promise<AttachmentUploadBatchResult> {
  const results = await Promise.allSettled(
    params.files.map((file) => uploadAttachment({ ...params, file })),
  );
  const succeeded: AttachmentUploadSuccess[] = [];
  const failed: AttachmentUploadFailure[] = [];

  results.forEach((result, index) => {
    const file = params.files[index];
    if (result.status === "fulfilled") succeeded.push({ file, attachment: result.value });
    else failed.push({ file, error: result.reason });
  });

  return { succeeded, failed };
}

export async function listAttachments(entityType: string, entityId: number): Promise<Attachment[]> {
  const { data, error } = await createClient()
    .from("attachments")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toAttachment(row as AttachmentRow));
}

export async function listAttachmentsByEntities(entityType: string, ids: number[]): Promise<Attachment[]> {
  if (ids.length === 0) return [];
  const { data, error } = await createClient()
    .from("attachments")
    .select("*")
    .eq("entity_type", entityType)
    .in("entity_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toAttachment(row as AttachmentRow));
}

export async function deleteAttachment(params: { id: number; path: string }): Promise<void> {
  const client = createClient();
  const { error: storageError } = await client.storage.from(ATTACHMENTS_BUCKET).remove([params.path]);
  if (storageError) throw new Error(storageError.message);

  const deleteRow = () => client.from("attachments").delete().eq("id", params.id);
  const firstDelete = await deleteRow();
  if (!firstDelete.error) return;
  const retryDelete = await deleteRow();
  if (!retryDelete.error) return;

  throw new AttachmentConsistencyError(
    "파일은 삭제됐지만 첨부 정보 정리에 실패했습니다. 관리자 확인이 필요합니다.",
    "database_row",
    params.id,
    params.path,
    { cause: retryDelete.error },
  );
}

export async function repairAttachmentConsistency(error: AttachmentConsistencyError): Promise<void> {
  const client = createClient();
  if (error.orphanedResource === "storage_object") {
    const result = await client.storage.from(ATTACHMENTS_BUCKET).remove([error.path]);
    if (result.error) throw new Error(result.error.message);
    return;
  }
  if (error.attachmentId == null) throw new Error("복구할 첨부 정보 ID가 없습니다.");
  const result = await client.from("attachments").delete().eq("id", error.attachmentId);
  if (result.error) throw new Error(result.error.message);
}

export async function attachmentSignedUrl(
  path: string,
  options: {
    preset?: AttachmentImagePreset;
    mimeType?: string | null;
    expiresInSec?: number;
    transformationsEnabled?: boolean;
    download?: boolean | string;
  } = {},
): Promise<string> {
  return createPrivateAssetSignedUrl({
    bucket: ATTACHMENTS_BUCKET,
    path,
    ...options,
  });
}
