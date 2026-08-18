import { useQuery } from "@tanstack/react-query";
import {
  getPlatformOverview,
  listPlatformAccounts,
  listPlatformOrganizations,
  listPointTransactions,
  type PointTxType,
} from "./apis";
import { getOrgBuildings, getBuildingTenants, getUnitOccupancy } from "./drilldown";
import {
  listMessagePointRates,
  listPointReservations,
  type PointReservationStatus,
} from "./pointBilling";
import { platformKeys } from "./keys";

export function usePlatformOverview() {
  return useQuery({
    queryKey: platformKeys.overview(),
    queryFn: getPlatformOverview,
  });
}

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: platformKeys.organizations(),
    queryFn: () => listPlatformOrganizations({ includeDeleted: true }),
  });
}

export function usePlatformAccounts() {
  return useQuery({
    queryKey: platformKeys.accounts(),
    queryFn: listPlatformAccounts,
  });
}

export function usePlatformTransactions(opts?: { type?: PointTxType }) {
  return useQuery({
    queryKey: platformKeys.transactions(opts),
    queryFn: () => listPointTransactions(opts),
  });
}

export function useMessagePointRates(includeHistory = false) {
  return useQuery({
    queryKey: platformKeys.messagePointRates(includeHistory),
    queryFn: () => listMessagePointRates(includeHistory),
  });
}

export function usePointReservations(status?: PointReservationStatus) {
  return useQuery({
    queryKey: platformKeys.pointReservations(status),
    queryFn: () => listPointReservations(status),
  });
}

export function useOrgBuildings(orgId: number) {
  return useQuery({
    queryKey: platformKeys.orgBuildings(orgId),
    queryFn: () => getOrgBuildings(orgId),
    enabled: Number.isFinite(orgId) && orgId > 0,
  });
}

export function useBuildingTenants(buildingId: number) {
  return useQuery({
    queryKey: platformKeys.buildingTenants(buildingId),
    queryFn: () => getBuildingTenants(buildingId),
    enabled: Number.isFinite(buildingId) && buildingId > 0,
  });
}

export function useUnitOccupancy(unitId: number) {
  return useQuery({
    queryKey: platformKeys.unit(unitId),
    queryFn: () => getUnitOccupancy(unitId),
    enabled: Number.isFinite(unitId) && unitId > 0,
  });
}
