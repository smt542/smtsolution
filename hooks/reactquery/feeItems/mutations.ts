import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFeeItem, updateFeeItem, deleteFeeItem, reorderFeeItems, type FeeItemInput } from "./apis";
import { feeItemKeys } from "./keys";

export function useCreateFeeItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: FeeItemInput) => createFeeItem(i), onSuccess: () => qc.invalidateQueries({ queryKey: feeItemKeys.all }) });
}

export function useUpdateFeeItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: Partial<FeeItemInput> }) => updateFeeItem(id, input), onSuccess: () => qc.invalidateQueries({ queryKey: feeItemKeys.all }) });
}

export function useDeleteFeeItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (args: { id: number; isRequired: boolean }) => deleteFeeItem(args), onSuccess: () => qc.invalidateQueries({ queryKey: feeItemKeys.all }) });
}

export function useReorderFeeItems() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (orderedIds: number[]) => reorderFeeItems(orderedIds), onSuccess: () => qc.invalidateQueries({ queryKey: feeItemKeys.all }) });
}
