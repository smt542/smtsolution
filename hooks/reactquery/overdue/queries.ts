import { useQuery } from "@tanstack/react-query";
import {
  listOverdueBuildings,
  listOverdueHouseholds,
  resolveOverdueQuery,
  type OverdueQueryParams,
} from "./apis";
import { overdueKeys } from "./keys";

export function useOverdueBuildings(enabled = true) {
  return useQuery({
    queryKey: overdueKeys.buildings(),
    queryFn: listOverdueBuildings,
    enabled,
  });
}

export function useOverdueHouseholds(
  buildingId: number | null,
  params: OverdueQueryParams = {},
) {
  const query = resolveOverdueQuery(params);
  return useQuery({
    queryKey: overdueKeys.households(
      buildingId ?? 0,
      query.year,
      query.month,
      query.scope,
    ),
    queryFn: () => listOverdueHouseholds(buildingId as number, query),
    enabled: buildingId !== null,
  });
}

