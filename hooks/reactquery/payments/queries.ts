import { useQuery } from "@tanstack/react-query";
import { listBankPayments, listPaymentRows, listUnitPayments } from "./apis";
import { paymentKeys } from "./keys";

export function usePaymentRows(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.rows(buildingId ?? 0, period),
    queryFn: () => listPaymentRows(buildingId as number, period),
    enabled: buildingId !== null && Boolean(period),
  });
}
export function useUnitPayments(unitId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.unit(unitId ?? 0, period),
    queryFn: () => listUnitPayments(unitId as number, period),
    enabled: unitId !== null && Boolean(period),
  });
}
export function useBankPayments(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.bank(buildingId ?? 0, period),
    queryFn: () => listBankPayments(buildingId as number, period),
    enabled: buildingId !== null && Boolean(period),
  });
}
