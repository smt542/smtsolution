import { useQuery } from "@tanstack/react-query";
import { getUnit, listUnits } from "./apis";
import { unitKeys } from "./keys";

export function useUnit(id: number) {
  return useQuery({ queryKey: unitKeys.one(id), queryFn: () => getUnit(id), enabled: !!id });
}
export function useUnits(buildingId: number) {
  return useQuery({ queryKey: unitKeys.byBuilding(buildingId), queryFn: () => listUnits(buildingId), enabled: !!buildingId });
}
