import { useQuery } from "@tanstack/react-query";
import { listUtilityRows, type UtilityType } from "./apis";
import { utilityKeys } from "./keys";

export function useUtilityRows(
  buildingId: number | null,
  utilityType: UtilityType,
) {
  return useQuery({
    queryKey: utilityKeys.rows(buildingId, utilityType),
    queryFn: () => listUtilityRows(buildingId as number, utilityType),
    enabled: buildingId !== null,
  });
}
