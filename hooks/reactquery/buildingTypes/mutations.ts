import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBuildingType, renameBuildingType, deleteBuildingType, reorderBuildingTypes, type BuildingTypeInput } from "./apis";
import { buildingTypeKeys } from "./keys";

export function useCreateBuildingType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: BuildingTypeInput) => createBuildingType(i), onSuccess: () => qc.invalidateQueries({ queryKey: buildingTypeKeys.all }) });
}

export function useRenameBuildingType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, label }: { id: number; label: string }) => renameBuildingType(id, label), onSuccess: () => qc.invalidateQueries({ queryKey: buildingTypeKeys.all }) });
}

export function useDeleteBuildingType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteBuildingType(id), onSuccess: () => qc.invalidateQueries({ queryKey: buildingTypeKeys.all }) });
}

export function useReorderBuildingTypes() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (orderedIds: number[]) => reorderBuildingTypes(orderedIds), onSuccess: () => qc.invalidateQueries({ queryKey: buildingTypeKeys.all }) });
}
