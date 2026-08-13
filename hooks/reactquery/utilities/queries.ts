import { useQuery } from "@tanstack/react-query";
import {
  getUtilityConfirmation,
  listMeterHistory,
  listUtilityPrices,
  listUtilityRows,
  type UtilityType,
} from "./apis";
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

export function useUtilityPrices(
  buildingId: number | null,
  utilityType: UtilityType,
) {
  return useQuery({
    queryKey: utilityKeys.prices(buildingId, utilityType),
    queryFn: () => listUtilityPrices(buildingId as number, utilityType),
    enabled: buildingId !== null,
  });
}

export function useUtilityConfirmation(
  buildingId: number | null,
  utilityType: UtilityType,
  period: string,
) {
  return useQuery({
    queryKey: utilityKeys.confirmation(buildingId, utilityType, period),
    queryFn: () => getUtilityConfirmation(buildingId as number, utilityType, period),
    enabled: buildingId !== null,
  });
}
