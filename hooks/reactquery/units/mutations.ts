import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUnit, updateUnit, deleteUnit, type UnitInput } from "./apis";
import { unitKeys } from "./keys";

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: UnitInput) => createUnit(i), onSuccess: () => qc.invalidateQueries({ queryKey: unitKeys.all }) });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: Partial<UnitInput> }) => updateUnit(id, input), onSuccess: () => qc.invalidateQueries({ queryKey: unitKeys.all }) });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteUnit(id), onSuccess: () => qc.invalidateQueries({ queryKey: unitKeys.all }) });
}
