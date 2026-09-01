// hooks/reactquery/buildingCustomerNumbers/queries.ts
import { useQuery } from "@tanstack/react-query";
import {
  listCustomerNumbers,
  listCustomerNumbersByBuilding,
  listBuildingMeterDays,
  type CustomerNumberFilters,
} from "./apis";
import { customerNumberKeys } from "./keys";

/** 검침일 필터가 활성일 때만 현재 페이지 건물들의 검침일을 조회한다. */
export function useBuildingMeterDays(buildingIds: number[], enabled: boolean) {
  return useQuery({
    queryKey: customerNumberKeys.meterDays(buildingIds),
    queryFn: () => listBuildingMeterDays(buildingIds),
    enabled: enabled && buildingIds.length > 0,
  });
}
export function useCustomerNumbers(buildingId: number) {
  return useQuery({
    queryKey: customerNumberKeys.byBuilding(buildingId),
    queryFn: () => listCustomerNumbersByBuilding(buildingId),
    enabled: !!buildingId,
  });
}

export function useCustomerNumberLookup(filters: CustomerNumberFilters) {
  return useQuery({
    queryKey: customerNumberKeys.lookup(filters),
    queryFn: () => listCustomerNumbers(filters),
  });
}
