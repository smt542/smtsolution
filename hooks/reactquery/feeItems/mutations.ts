import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFeeItem, updateFeeItem, deleteFeeItem, reorderFeeItems, type FeeItem, type FeeItemInput } from "./apis";
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
  return useMutation({
    mutationFn: (orderedIds: number[]) => reorderFeeItems(orderedIds),
    // Reorder is driven by drag and drop, so the new order has to hold on screen
    // instead of snapping back while the refetch is in flight.
    onMutate: async (orderedIds: number[]) => {
      await qc.cancelQueries({ queryKey: feeItemKeys.all });
      const snapshot = qc.getQueriesData<FeeItem[]>({ queryKey: feeItemKeys.all });
      const rank = new Map(orderedIds.map((id, index) => [id, index] as const));
      snapshot.forEach(([key, data]) => {
        if (!Array.isArray(data)) return;
        qc.setQueryData<FeeItem[]>(key, data.map((item) => {
          const sortOrder = rank.get(item.id);
          return sortOrder == null ? item : { ...item, sortOrder };
        }));
      });
      return { snapshot };
    },
    onError: (_error, _orderedIds, context) => {
      context?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: feeItemKeys.all }),
  });
}
