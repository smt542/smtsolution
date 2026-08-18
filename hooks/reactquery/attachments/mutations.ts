// hooks/reactquery/attachments/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadAttachment, deleteAttachment } from "./apis";
import { attachmentKeys } from "./keys";
export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadAttachment,
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentKeys.all }),
  });
}
export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAttachment,
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentKeys.all }),
  });
}
