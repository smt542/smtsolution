import { useQuery } from "@tanstack/react-query";
import { listHistoryByUnit } from "./apis"; import { occupancyHistoryKeys } from "./keys";
export function useOccupancyHistory(unitId: number) {
  return useQuery({ queryKey: occupancyHistoryKeys.byUnit(unitId), queryFn: () => listHistoryByUnit(unitId), enabled: !!unitId });
}
