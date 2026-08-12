import { useQuery } from "@tanstack/react-query";
import { listOverdueBuildings, listOverdueHouseholds } from "./apis";
import { overdueKeys } from "./keys";

export function useOverdueBuildings(enabled = true) {
  return useQuery({
    queryKey: overdueKeys.buildings(),
    queryFn: listOverdueBuildings,
    enabled,
  });
}

export function useOverdueHouseholds(buildingId: number | null) {
  return useQuery({
    queryKey: overdueKeys.households(buildingId ?? 0),
    queryFn: () => listOverdueHouseholds(buildingId as number),
    enabled: buildingId !== null,
  });
}

