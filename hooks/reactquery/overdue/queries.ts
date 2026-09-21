import { useQuery } from "@tanstack/react-query";
import {
  listOverdueBuildings,
  listOverdueHouseholds,
  listOverduePeriods,
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

/**
 * `buildingId`는 선택값이다 — null 이면 org 전체 건물을 조회한다(정본과 동일).
 * 조회 여부는 건물이 아니라 `enabled`(= 년·월 선택 여부)가 정한다.
 */
export function useOverdueHouseholds(
  buildingId: number | null,
  params: OverdueQueryParams = {},
  enabled = true,
) {
  const query = resolveOverdueQuery(params);
  return useQuery({
    queryKey: overdueKeys.households(
      buildingId ?? 0,
      query.year,
      query.month,
      query.scope,
    ),
    queryFn: () => listOverdueHouseholds(buildingId, query),
    enabled,
  });
}

export function useOverduePeriods(
  buildingId: number | null,
  params: OverdueQueryParams = {},
  enabled = true,
) {
  const query = resolveOverdueQuery(params);
  return useQuery({
    queryKey: overdueKeys.periods(
      buildingId ?? 0,
      query.year,
      query.month,
      query.scope,
    ),
    queryFn: () => listOverduePeriods(buildingId, query),
    enabled,
  });
}

