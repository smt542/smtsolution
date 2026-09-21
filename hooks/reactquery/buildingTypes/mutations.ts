import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBuildingType, renameBuildingType, deleteBuildingType, reorderBuildingTypes, type BuildingTypeInput } from "./apis";
import { buildingTypeKeys } from "./keys";
import { feeItemKeys } from "../feeItems/keys";

export function useCreateBuildingType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: BuildingTypeInput) => createBuildingType(i),
    // 유형과 필수 항목을 함께 만들기 때문에 부분 실패해도 목록을 다시 맞춘다.
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: buildingTypeKeys.all }),
      qc.invalidateQueries({ queryKey: feeItemKeys.all }),
    ]),
  });
}

export function useRenameBuildingType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, label }: { id: number; label: string }) => renameBuildingType(id, label), onSuccess: () => qc.invalidateQueries({ queryKey: buildingTypeKeys.all }) });
}

export function useDeleteBuildingType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBuildingType(id),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: buildingTypeKeys.all }),
      qc.invalidateQueries({ queryKey: feeItemKeys.all }),
    ]),
  });
}

export function useReorderBuildingTypes() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (orderedIds: number[]) => reorderBuildingTypes(orderedIds), onSuccess: () => qc.invalidateQueries({ queryKey: buildingTypeKeys.all }) });
}
