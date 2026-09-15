import { useQueries, useQuery } from "@tanstack/react-query";
import {
  listTenants,
  getUnitOccupancyFull,
  listOccupancies,
  type TenantListRow,
} from "./apis";
import { occupancyKeys } from "./keys";
export function useTenantList(buildingId: number) {
  return useQuery({ queryKey: occupancyKeys.tenantList(buildingId), queryFn: () => listTenants(buildingId), enabled: !!buildingId });
}
export interface OrganizationTenantListRow extends TenantListRow {
  buildingId: number;
}
export function useOrganizationTenantList(buildingIds: number[]) {
  const ids = [...new Set(buildingIds)].filter((id) => id > 0);
  const queries = useQueries({
    queries: ids.map((buildingId) => ({
      queryKey: occupancyKeys.tenantList(buildingId),
      queryFn: () => listTenants(buildingId),
    })),
  });

  return {
    data: queries.flatMap((query, index) =>
      (query.data ?? []).map((tenant) => ({ ...tenant, buildingId: ids[index] })),
    ),
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
    isError: queries.some((query) => query.isError),
  };
}
export function useUnitOccupancyFull(unitId: number) {
  return useQuery({ queryKey: occupancyKeys.full(unitId), queryFn: () => getUnitOccupancyFull(unitId), enabled: !!unitId });
}
export function useOccupancies(unitId: number) {
  return useQuery({ queryKey: occupancyKeys.byUnit(unitId), queryFn: () => listOccupancies(unitId), enabled: !!unitId });
}
