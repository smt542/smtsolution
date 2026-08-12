import { useQuery } from "@tanstack/react-query";
import { listTenants, getUnitOccupancyFull, listOccupancies } from "./apis"; import { occupancyKeys } from "./keys";
export function useTenantList(buildingId: number) {
  return useQuery({ queryKey: occupancyKeys.tenantList(buildingId), queryFn: () => listTenants(buildingId), enabled: !!buildingId });
}
export function useUnitOccupancyFull(unitId: number) {
  return useQuery({ queryKey: occupancyKeys.full(unitId), queryFn: () => getUnitOccupancyFull(unitId), enabled: !!unitId });
}
export function useOccupancies(unitId: number) {
  return useQuery({ queryKey: occupancyKeys.byUnit(unitId), queryFn: () => listOccupancies(unitId), enabled: !!unitId });
}
