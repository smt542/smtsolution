// hooks/reactquery/attachments/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listAttachments } from "./apis";
import { attachmentKeys } from "./keys";
export function useAttachments(entityType: string, entityId: number) {
  return useQuery({
    queryKey: attachmentKeys.byEntity(entityType, entityId),
    queryFn: () => listAttachments(entityType, entityId),
    enabled: !!entityId,
  });
}
