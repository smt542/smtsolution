import { useQuery } from "@tanstack/react-query";
import { listUtilityRows, listMeterHistory, type UtilityType } from "./apis";
import { utilityKeys } from "./keys";

export function useUtilityRows(
  buildingId: number | null,
  utilityType: UtilityType,
  period: string,
) {
  return useQuery({
    queryKey: utilityKeys.rows(buildingId, utilityType, period),
    queryFn: () => listUtilityRows(buildingId as number, utilityType, period),
    enabled: buildingId !== null,
  });
}

export function useMeterHistory(
  unitId: number | null,
  utilityType: UtilityType,
  period: string,
) {
  return useQuery({
    queryKey: utilityKeys.history(unitId, utilityType, period),
    queryFn: () => listMeterHistory(unitId as number, utilityType, period),
    enabled: unitId !== null,
  });
}
