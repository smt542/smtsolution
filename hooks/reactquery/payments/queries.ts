import { useQueries, useQuery } from "@tanstack/react-query";
import {
  getPaymentReceiverName,
  listBankPayments,
  listGiroPaymentDetails,
  listGiroPayments,
  listPaymentsByPaidDate,
  listPaymentRows,
  listUnitOverpayments,
  listUnitPayments,
  type UnitOverpayment,
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
/** 세대 과수납 원장(QA #31). 수납 이력에서 그 달 초과분을 연체료와 나눠 보여 줄 때 쓴다. */
export function useUnitOverpayments(unitId: number | null) {
  return useQuery({
    queryKey: paymentKeys.overpayments(unitId ?? 0),
    queryFn: () => listUnitOverpayments(unitId as number),
    enabled: unitId !== null,
  });
}

const EMPTY_OVERPAID = new Map<string, number>();

function toOverpaidByMonth(rows: UnitOverpayment[]): ReadonlyMap<string, number> {
  return new Map(
    rows
      .filter((row) => row.status !== "canceled" && row.amount > 0)
      .map((row) => [row.sourcePeriod.slice(0, 7), row.amount]),
  );
}

/** 달(YYYY-MM) → 과수납액. 같은 원장 쿼리를 공유한다(수납 이력 표·영수증). */
export function useUnitOverpaidByMonth(unitId: number | null): ReadonlyMap<string, number> {
  const { data } = useQuery({
    queryKey: paymentKeys.overpayments(unitId ?? 0),
    queryFn: () => listUnitOverpayments(unitId as number),
    enabled: unitId !== null,
    select: toOverpaidByMonth,
  });
  return data ?? EMPTY_OVERPAID;
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
export function useGiroPaymentsPeriods(periods: string[], enabled: boolean) {
  const queries = useQueries({
    queries: periods.map((period) => ({
      queryKey: paymentKeys.giro(null, period),
      queryFn: () => listGiroPayments(null, period),
      enabled: enabled && Boolean(period),
    })),
  });

  return {
    periods: periods.map((period, index) => ({
      period,
      data: queries[index]?.data ?? [],
    })),
    isLoading: enabled && queries.some((query) => query.isLoading),
  };
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
