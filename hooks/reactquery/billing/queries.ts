import { useQuery } from "@tanstack/react-query";
import { getBillingPeriodSetting, listBilling, listBillingHistory, listUnchargedNewOccupancies } from "./apis";
import { billingKeys } from "./keys";

export function useBilling(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: billingKeys.list(buildingId ?? 0, period),
    queryFn: () => listBilling(buildingId as number, period),
    enabled: !!buildingId,
  });
}
export function useBillingHistory(unitId: number | null, period: string, months = 6) {
  return useQuery({
    queryKey: billingKeys.history(unitId ?? 0, period, months),
    queryFn: () => listBillingHistory(unitId as number, period, months),
    enabled: !!unitId,
  });
}
export function useBillingPeriodSetting(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: billingKeys.periodSetting(buildingId ?? 0, period),
    queryFn: () => getBillingPeriodSetting(buildingId as number, period),
    enabled: !!buildingId,
  });
}
export function useUnchargedNewOccupancies(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: billingKeys.newOccupancies(buildingId ?? 0, period),
    queryFn: () => listUnchargedNewOccupancies(buildingId as number, period),
    enabled: !!buildingId,
  });
}
