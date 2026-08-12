import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSettlementCheckItem, renameSettlementCheckItem, deleteSettlementCheckItem, type SettlementCheckItemInput } from "./apis";
import { settlementCheckItemKeys } from "./keys";

export function useCreateSettlementCheckItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: SettlementCheckItemInput) => createSettlementCheckItem(i), onSuccess: () => qc.invalidateQueries({ queryKey: settlementCheckItemKeys.all }) });
}

export function useRenameSettlementCheckItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, label }: { id: number; label: string }) => renameSettlementCheckItem(id, label), onSuccess: () => qc.invalidateQueries({ queryKey: settlementCheckItemKeys.all }) });
}

export function useDeleteSettlementCheckItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteSettlementCheckItem(id), onSuccess: () => qc.invalidateQueries({ queryKey: settlementCheckItemKeys.all }) });
}
