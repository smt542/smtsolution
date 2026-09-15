import { createClient } from "@/lib/supabase/client";
import { validateAttachmentFile } from "@/lib/attachments/policy";
import {
  deleteAttachment,
  listAttachments,
} from "@/hooks/reactquery/attachments/apis";
import {
  applyUploadedNoticeImages,
  buildNoticeImagePath,
  collectNoticeImagePaths,
  collectPendingNoticeImageIds,
  NOTICE_ATTACHMENTS_BUCKET,
  NOTICE_IMAGE_ENTITY_TYPE,
  NOTICE_IMAGE_KIND,
} from "@/lib/notice/images";
import type { NoticeDoc } from "@/lib/notice/richText";

/**
 * 공지 본문 이미지 저장 오케스트레이션(클라이언트, staff 세션).
 *
 * 저장 순서(고아 방지):
 *  1) prepare: pending File을 Storage에만 업로드하고 content_json을 object path로 치환.
 *  2) 공지 insert/update(치환된 content_json 저장) — 실패 시 caller가 업로드 object를 보상 삭제.
 *  3) finalize: 업로드분 attachments row 생성 + 본문에서 빠진 이미지(Storage+row) 정리.
 * notice 삭제는 soft delete(이력 보존)라 이미지를 지우지 않는다. 이미지 정리는 update 시 수행한다.
 */

export interface UploadedNoticeImage {
  pendingId: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}

/** Storage 전용 업로드(row는 notice id 확정 후 생성). 실패 시 throw. */
async function uploadNoticeImageObject(
  orgId: number,
  pendingId: string,
  file: File,
): Promise<UploadedNoticeImage> {
  const validationError = validateAttachmentFile(file, "image");
  if (validationError) throw new Error(validationError);

  const path = buildNoticeImagePath({ orgId, fileName: file.name });
  const { error } = await createClient()
    .storage.from(NOTICE_ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  return {
    pendingId,
    path,
    mimeType: file.type,
    sizeBytes: file.size,
    fileName: file.name,
  };
}

/** 저장 실패 시 보상 삭제: 방금 업로드한 object를 Storage에서 제거(row는 아직 없음). */
export async function removeNoticeImageObjects(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  await createClient()
    .storage.from(NOTICE_ATTACHMENTS_BUCKET)
    .remove([...paths]);
}

export interface PrepareNoticeImagesResult {
  nextDoc: NoticeDoc;
  uploaded: UploadedNoticeImage[];
  failedCount: number;
}

/**
 * pending 이미지를 Storage에 업로드하고 content_json을 object path로 치환한다.
 * 업로드 실패한 노드는 문서에서 제거하고 개수만 보고한다(부분 성공).
 * 저장할 이미지가 없으면 원본 문서를 그대로 돌려준다(Supabase 미호출).
 */
export async function prepareNoticeImages(params: {
  orgId: number;
  doc: NoticeDoc;
  pendingFiles: Map<string, File>;
}): Promise<PrepareNoticeImagesResult> {
  const { orgId, doc, pendingFiles } = params;
  const pendingIds = collectPendingNoticeImageIds(doc).filter((id) => pendingFiles.has(id));
  if (pendingIds.length === 0) {
    return { nextDoc: doc, uploaded: [], failedCount: 0 };
  }

  const results = await Promise.allSettled(
    pendingIds.map((pendingId) =>
      uploadNoticeImageObject(orgId, pendingId, pendingFiles.get(pendingId)!),
    ),
  );

  const uploaded: UploadedNoticeImage[] = [];
  let failedCount = 0;
  results.forEach((result) => {
    if (result.status === "fulfilled") uploaded.push(result.value);
    else failedCount += 1;
  });

  // 해석된(성공한) 업로드만 path로 치환하고, 실패·누락 pending 노드는 문서에서 제거된다.
  const resolved = new Map(uploaded.map((image) => [image.pendingId, image.path]));
  const nextDoc = applyUploadedNoticeImages(doc, resolved);
  return { nextDoc, uploaded, failedCount };
}

/** 업로드분 attachments row 생성. 실패해도 이미지 자체는 content_json+서명으로 표시되므로 개수만 보고. */
async function insertNoticeImageRows(
  orgId: number,
  noticeId: number,
  images: readonly UploadedNoticeImage[],
): Promise<number> {
  if (images.length === 0) return 0;
  const { error } = await createClient()
    .from("attachments")
    .insert(
      images.map((image) => ({
        org_id: orgId,
        entity_type: NOTICE_IMAGE_ENTITY_TYPE,
        entity_id: noticeId,
        kind: NOTICE_IMAGE_KIND,
        file_url: image.path,
        file_name: image.fileName,
        mime_type: image.mimeType,
        size_bytes: image.sizeBytes,
      })),
    );
  return error ? images.length : 0;
}

/** 본문에서 빠진 이미지의 Storage object와 attachments row를 정리한다(고아 방지). */
async function deleteRemovedNoticeImages(
  noticeId: number,
  removedPaths: readonly string[],
): Promise<void> {
  if (removedPaths.length === 0) return;
  const removedSet = new Set(removedPaths);
  const rows = await listAttachments(NOTICE_IMAGE_ENTITY_TYPE, noticeId);
  const targets = rows.filter((row) => removedSet.has(row.fileUrl));
  const matched = new Set(targets.map((row) => row.fileUrl));

  for (const row of targets) {
    await deleteAttachment({ id: row.id, path: row.fileUrl });
  }
  // row가 없는 잔여 object(예: 과거 row 생성 실패분)는 Storage에서 직접 제거.
  const orphanObjects = removedPaths.filter((path) => !matched.has(path));
  if (orphanObjects.length > 0) await removeNoticeImageObjects(orphanObjects);
}

export interface FinalizeNoticeImagesResult {
  rowFailedCount: number;
}

/** 저장 성공 후: 업로드분 row 생성 + 본문에서 빠진 이미지 정리. */
export async function finalizeNoticeImages(params: {
  orgId: number;
  noticeId: number;
  uploaded: readonly UploadedNoticeImage[];
  previousDoc: NoticeDoc | null | undefined;
  nextDoc: NoticeDoc;
}): Promise<FinalizeNoticeImagesResult> {
  const { orgId, noticeId, uploaded, previousDoc, nextDoc } = params;
  const rowFailedCount = await insertNoticeImageRows(orgId, noticeId, uploaded);

  const nextPaths = new Set(collectNoticeImagePaths(nextDoc));
  const removed = collectNoticeImagePaths(previousDoc).filter((path) => !nextPaths.has(path));
  await deleteRemovedNoticeImages(noticeId, removed);

  return { rowFailedCount };
}
