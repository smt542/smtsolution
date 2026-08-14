import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelPayment, recordPayment, type RecordPaymentInput } from "./apis";
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
