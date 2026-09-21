import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBuildingType, renameBuildingType, deleteBuildingType, reorderBuildingTypes, type BuildingType, type BuildingTypeInput } from "./apis";
import { buildingTypeKeys } from "./keys";
import { feeItemKeys } from "../feeItems/keys";

export function useCreateBuildingType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: BuildingTypeInput) => createBuildingType(i),
    // 트리거가 필수 항목까지 만들므로 fee_items 캐시도 함께 무효화한다.
    onSuccess: (created) => {
      qc.setQueryData<BuildingType[]>(buildingTypeKeys.list(), (current) => [
        ...(current ?? []),
        created,
      ]);
      void qc.invalidateQueries({ queryKey: buildingTypeKeys.all });
      void qc.invalidateQueries({ queryKey: feeItemKeys.all });
    },
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
