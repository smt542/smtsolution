import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveUnitOccupancy, type SaveUnitOccupancyPayload } from "./apis"; import { occupancyKeys } from "./keys";
export function useSaveUnitOccupancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveUnitOccupancyPayload) => saveUnitOccupancy(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: occupancyKeys.all }),
  });
}
