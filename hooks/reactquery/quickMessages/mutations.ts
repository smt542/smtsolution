import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createQuickMessage, updateQuickMessage, deleteQuickMessage, type QuickMessageInput } from "./apis";
import { quickMessageKeys } from "./keys";
export function useCreateQuickMessage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: QuickMessageInput) => createQuickMessage(i), onSuccess: () => qc.invalidateQueries({ queryKey: quickMessageKeys.all }) });
}
export function useUpdateQuickMessage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: Partial<QuickMessageInput> }) => updateQuickMessage(id, input), onSuccess: () => qc.invalidateQueries({ queryKey: quickMessageKeys.all }) });
}
export function useDeleteQuickMessage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteQuickMessage(id), onSuccess: () => qc.invalidateQueries({ queryKey: quickMessageKeys.all }) });
}
