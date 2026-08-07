import { useQuery } from "@tanstack/react-query";
import { listOccupancies, getOccupancy } from "./apis";
import { occupancyKeys } from "./keys";

export function useOccupancies(unitId: number) {
  return useQuery({ queryKey: occupancyKeys.list(unitId), queryFn: () => listOccupancies(unitId), enabled: !!unitId });
}

export function useOccupancy(id: number) {
  return useQuery({ queryKey: occupancyKeys.one(id), queryFn: () => getOccupancy(id), enabled: !!id });
}
