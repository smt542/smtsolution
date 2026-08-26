import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getPlatformOverview,
  getPlatformOrganizationContractKpis,
  listPlatformAccounts,
  listPlatformOrganizations,
  listPointTransactions,
  type PlatformAccountQuery,
  type PlatformOrganizationQuery,
  type PointTransactionCursor,
  type PointTransactionQuery,
} from "./apis";
import { getOrgBuildings, getBuildingTenants, getUnitOccupancy } from "./drilldown";
import {
  listMessagePointRates,
  listPointReservations,
  type PointReservationQuery,
} from "./pointBilling";
import { platformKeys } from "./keys";

export function usePlatformOverview() {
  return useQuery({
    queryKey: platformKeys.overview(),
    queryFn: getPlatformOverview,
  });
}

export function usePlatformOrganizations(opts: PlatformOrganizationQuery = {}) {
  return useQuery({
    queryKey: platformKeys.organizations(opts),
    queryFn: () => listPlatformOrganizations(opts),
  });
}

export function usePlatformOrganizationContractKpis() {
  return useQuery({
    queryKey: platformKeys.organizationContractKpis(),
    queryFn: getPlatformOrganizationContractKpis,
  });
}

export function usePlatformAccounts(opts: PlatformAccountQuery = {}) {
  return useQuery({
    queryKey: platformKeys.accounts(opts),
    queryFn: () => listPlatformAccounts(opts),
  });
}

export function usePlatformTransactions(
  opts: Omit<PointTransactionQuery, "cursor"> = {},
) {
  return useInfiniteQuery({
    queryKey: platformKeys.transactions(opts),
    queryFn: ({ pageParam }) =>
      listPointTransactions({ ...opts, cursor: pageParam }),
    initialPageParam: null as PointTransactionCursor | null,
    getNextPageParam: (lastPage, pages) => {
      const loadedCount = pages.reduce((total, page) => total + page.rows.length, 0);
      return loadedCount < lastPage.totalCount ? lastPage.nextCursor : undefined;
    },
  });
}

export function useMessagePointRates(includeHistory = false) {
  return useQuery({
    queryKey: platformKeys.messagePointRates(includeHistory),
    queryFn: () => listMessagePointRates(includeHistory),
  });
}

export function usePointReservations(opts: PointReservationQuery = {}) {
  return useQuery({
    queryKey: platformKeys.pointReservations(opts),
    queryFn: () => listPointReservations(opts),
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
