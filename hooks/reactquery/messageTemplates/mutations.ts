import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMessageTemplate, updateMessageTemplate, deleteMessageTemplate, type MessageTemplateInput } from "./apis";
import { messageTemplateKeys } from "./keys";
export function useCreateMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: MessageTemplateInput) => createMessageTemplate(i), onSuccess: () => qc.invalidateQueries({ queryKey: messageTemplateKeys.all }) });
}
export function useUpdateMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: Partial<MessageTemplateInput> }) => updateMessageTemplate(id, input), onSuccess: () => qc.invalidateQueries({ queryKey: messageTemplateKeys.all }) });
}
export function useDeleteMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteMessageTemplate(id), onSuccess: () => qc.invalidateQueries({ queryKey: messageTemplateKeys.all }) });
}
