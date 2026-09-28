import { useQuery } from "@tanstack/react-query";
import {
  getPaymentReceiverName,
  listBankPayments,
  listGiroPaymentDetails,
  listGiroPayments,
  listPaymentsByPaidDate,
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
export function useGiroPaymentDetails(period: string) {
  return useQuery({
    queryKey: paymentKeys.giroDetails(period),
    queryFn: () => listGiroPaymentDetails(period),
    enabled: Boolean(period),
  });
}

export function usePaymentsByPaidDate(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = new Date(Date.UTC(year, month, 0));
  const to = toDate.toISOString().slice(0, 10);

  return useQuery({
    queryKey: paymentKeys.paidDate(year, month),
    queryFn: () => listPaymentsByPaidDate(from, to),
    enabled: Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12,
  });
}
