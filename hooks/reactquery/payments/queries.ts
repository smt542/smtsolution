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
/** buildingId가 null이면 선택된 건물과 무관하게 조직 전체를 조회한다. */
export function useBankPayments(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.bank(buildingId, period),
    queryFn: () => listBankPayments(buildingId, period),
    enabled: Boolean(period),
  });
}
/** buildingId가 null이면 선택된 건물과 무관하게 조직 전체를 조회한다. */
export function useGiroPayments(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.giro(buildingId, period),
    queryFn: () => listGiroPayments(buildingId, period),
    enabled: Boolean(period),
  });
}
