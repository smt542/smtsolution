import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOccupancy, updateOccupancy, deleteOccupancy, type OccupancyInput } from "./apis";
import { occupancyKeys } from "./keys";

export function useCreateOccupancy() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: OccupancyInput) => createOccupancy(i), onSuccess: () => qc.invalidateQueries({ queryKey: occupancyKeys.all }) });
}

export function useUpdateOccupancy() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: Partial<OccupancyInput> }) => updateOccupancy(id, input), onSuccess: () => qc.invalidateQueries({ queryKey: occupancyKeys.all }) });
}

export function useDeleteOccupancy() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteOccupancy(id), onSuccess: () => qc.invalidateQueries({ queryKey: occupancyKeys.all }) });
}
