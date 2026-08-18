// hooks/reactquery/attachments/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listAttachments, listAttachmentsByEntities } from "./apis";
import { attachmentKeys } from "./keys";
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
