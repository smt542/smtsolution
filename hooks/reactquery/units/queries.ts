import { useQuery } from "@tanstack/react-query";
import { listUnits, getUnit } from "./apis";
import { unitKeys } from "./keys";

export function useUnits(buildingId: number) {
  return useQuery({ queryKey: unitKeys.list(buildingId), queryFn: () => listUnits(buildingId), enabled: !!buildingId });
}

export function useUnit(id: number) {
  return useQuery({ queryKey: unitKeys.one(id), queryFn: () => getUnit(id), enabled: !!id });
}
