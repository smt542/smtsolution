import { useQuery } from "@tanstack/react-query";
import { listBillTargets, getBillDocuments, getOrganizationName, listBillDueDates } from "./apis";
import { billKeys } from "./keys";

export function useBillTargets(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: billKeys.targets(buildingId ?? 0, period),
    queryFn: () => listBillTargets(buildingId as number, period),
    enabled: !!buildingId,
  });
}

export function useBillDocuments(buildingId: number | null, period: string, unitIds: number[]) {
  return useQuery({
    queryKey: billKeys.documents(buildingId ?? 0, period, unitIds),
    queryFn: () => getBillDocuments(buildingId as number, period, unitIds),
    enabled: !!buildingId && unitIds.length > 0,
  });
}

export function useBillOrganizationName(orgId: number | null | undefined) {
  return useQuery({
    queryKey: billKeys.organization(orgId ?? 0),
    queryFn: () => getOrganizationName(orgId as number),
    enabled: !!orgId,
  });
}

export function useBillDueDates(unitIds: number[], period: string) {
  return useQuery({
    queryKey: billKeys.dueDates(period, unitIds),
    queryFn: () => listBillDueDates(unitIds, period),
    enabled: unitIds.length > 0,
  });
}
