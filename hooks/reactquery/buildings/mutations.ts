// hooks/reactquery/buildings/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveBuilding, deleteBuilding, type SaveBuildingPayload } from "./apis";
import { buildingKeys } from "./keys";

export function useSaveBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveBuildingPayload) => saveBuilding(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.all }),
  });
}
export function useDeleteBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBuilding(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.all }),
  });
}
