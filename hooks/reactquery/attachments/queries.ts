// hooks/reactquery/attachments/queries.ts
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  attachmentSignedUrl,
  listAttachments,
  listAttachmentsByEntities,
  type Attachment,
} from "./apis";
import { attachmentKeys } from "./keys";
import {
  SIGNED_URL_GC_TIME_MS,
  SIGNED_URL_STALE_TIME_MS,
  type AttachmentImagePreset,
} from "@/lib/attachments/signedUrl";
export function useAttachments(entityType: string, entityId: number) {
  return useQuery({
    queryKey: attachmentKeys.byEntity(entityType, entityId),
    queryFn: () => listAttachments(entityType, entityId),
    enabled: !!entityId,
  });
}

export function useAttachmentsByEntities(entityType: string, entityIds: number[]) {
  const sortedIds = [...entityIds].sort((a, b) => a - b);
  return useQuery({
    queryKey: attachmentKeys.byEntities(entityType, sortedIds),
    queryFn: () => listAttachmentsByEntities(entityType, sortedIds),
    enabled: sortedIds.length > 0,
  });
}

export interface AttachmentSignedUrlResult {
  attachment: Attachment;
  url: string | null;
  error: unknown;
  isPending: boolean;
}

export function useAttachmentSignedUrls(
  attachments: readonly Attachment[],
  preset: AttachmentImagePreset,
): AttachmentSignedUrlResult[] {
  const results = useQueries({
    queries: attachments.map((attachment) => ({
      queryKey: attachmentKeys.signedUrl(attachment.fileUrl, preset),
      queryFn: () => attachmentSignedUrl(attachment.fileUrl, {
        preset,
        mimeType: attachment.mimeType,
      }),
      staleTime: SIGNED_URL_STALE_TIME_MS,
      gcTime: SIGNED_URL_GC_TIME_MS,
      retry: 1,
    })),
  });

  return attachments.map((attachment, index) => ({
    attachment,
    url: results[index]?.data ?? null,
    error: results[index]?.error ?? null,
    isPending: results[index]?.isPending ?? false,
  }));
}
