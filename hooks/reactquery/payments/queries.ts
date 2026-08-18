import { useQuery } from "@tanstack/react-query";
import {
  getPaymentReceiverName,
  listBankPayments,
  listGiroPayments,
  listPaymentRows,
  listUnitPayments,
} from "./apis";
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
export function usePaymentReceiver(paymentId: number | null) {
  return useQuery({
    queryKey: paymentKeys.receiver(paymentId ?? 0),
    queryFn: () => getPaymentReceiverName(paymentId as number),
    enabled: paymentId !== null,
  });
}
export function useBankPayments(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.bank(buildingId ?? 0, period),
    queryFn: () => listBankPayments(buildingId as number, period),
    enabled: buildingId !== null && Boolean(period),
  });
}
export function useGiroPayments(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.giro(buildingId ?? 0, period),
    queryFn: () => listGiroPayments(buildingId as number, period),
    enabled: buildingId !== null && Boolean(period),
  });
}
