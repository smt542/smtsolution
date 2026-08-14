import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelPayment, recordBankPayments, recordPayment, type BankPaymentEntry, type RecordPaymentInput } from "./apis";
import { paymentKeys } from "./keys";

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => recordPayment(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.all }),
  });
}
export function useCancelPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: number) => cancelPayment(paymentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.all }),
  });
}
export function useRecordBankPayments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { buildingId: number; period: string; entries: BankPaymentEntry[] }) =>
      recordBankPayments(v.buildingId, v.period, v.entries),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.all }),
  });
}
