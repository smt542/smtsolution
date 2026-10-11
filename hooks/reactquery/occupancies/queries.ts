import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  listTenants,
  getTenantCardPrintData,
  getUnitOccupancyFull,
  listOccupancies,
  getUnitDeleteImpact,
  listLateFeeDisabledOccupancyIds,
  type TenantListRow,
} from "./apis";
import { occupancyKeys } from "./keys";
export function useTenantList(buildingId: number) {
  return useQuery({ queryKey: occupancyKeys.tenantList(buildingId), queryFn: () => listTenants(buildingId), enabled: !!buildingId });
}
export function useTenantCardPrintData(buildingId: number) {
  return useQuery({
    queryKey: occupancyKeys.tenantCardPrint(buildingId),
    queryFn: () => getTenantCardPrintData(buildingId),
    enabled: !!buildingId,
    // 원문 연락처가 담긴 응답이므로 화면을 벗어나면 캐시에 남기지 않는다.
    gcTime: 0,
  });
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

const EMPTY_OCCUPANCY_IDS: ReadonlySet<number> = new Set();

/**
 * 연체료 부과 여부가 X인 입주 id 집합. 연체료 계산 지점이 공통으로 쓴다(정책: 세대별 연체료 부과 여부 O/X).
 * 불러오기 전에는 빈 집합(전원 부과)이다.
 */
export function useLateFeeDisabledOccupancies(orgId?: number | null): ReadonlySet<number> {
  const { data } = useQuery({
    queryKey: occupancyKeys.lateFeeDisabled(orgId ?? 0),
    queryFn: listLateFeeDisabledOccupancyIds,
    enabled: !!orgId,
  });
  return useMemo(() => (data ? new Set(data) : EMPTY_OCCUPANCY_IDS), [data]);
}

/** 삭제 확인창을 열 때 조회한다(fetchQuery) — 이력이 바뀌었을 수 있어 항상 새로 받는다. */
export function unitDeleteImpactQuery(unitId: number) {
  return {
    queryKey: occupancyKeys.deleteImpact(unitId),
    queryFn: () => getUnitDeleteImpact(unitId),
    staleTime: 0,
  };
}
