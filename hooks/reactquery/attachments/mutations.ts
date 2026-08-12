// hooks/reactquery/attachments/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadAttachment, deleteAttachment } from "./apis";
import { attachmentKeys } from "./keys";
export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadAttachment,
    onSuccess: (a) => qc.invalidateQueries({ queryKey: attachmentKeys.byEntity(a.entityType, a.entityId) }),
  });
}
export function useDeleteAttachment(entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAttachment,
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentKeys.byEntity(entityType, entityId) }),
  });
}
