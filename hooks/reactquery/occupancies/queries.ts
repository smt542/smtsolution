import { useQuery } from "@tanstack/react-query";
import { listOccupancies } from "./apis";
import { occupancyKeys } from "./keys";

export function useOccupancies(unitId: number) {
  return useQuery({ queryKey: occupancyKeys.list(unitId), queryFn: () => listOccupancies(unitId), enabled: !!unitId });
}
