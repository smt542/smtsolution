import { useMutation, useQueryClient } from "@tanstack/react-query";
import { receiptKeys } from "@/hooks/reactquery/receipts/queries";
import {
  cancelPayment,
  recordBankPayments,
  recordGiroPayments,
  recordPayment,
  recordPaymentEdit,
  savePaymentHistory,
  type BankPaymentEntry,
  type PaymentHistoryOp,
  type GiroPaymentEntry,
  type RecordPaymentEditInput,
  type RecordPaymentInput,
} from "./apis";
import { paymentKeys } from "./keys";

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => recordPayment(input),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: paymentKeys.all }),
      qc.invalidateQueries({ queryKey: receiptKeys.all }),
    ]),
  });
}
export function useRecordPaymentEdit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentEditInput) => recordPaymentEdit(input),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: paymentKeys.all }),
      qc.invalidateQueries({ queryKey: receiptKeys.all }),
    ]),
  });
}
export function useCancelPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: number) => cancelPayment(paymentId),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: paymentKeys.all }),
      qc.invalidateQueries({ queryKey: receiptKeys.all }),
    ]),
  });
}
export function useSavePaymentHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ops: PaymentHistoryOp[]) => savePaymentHistory(ops),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: paymentKeys.all }),
      qc.invalidateQueries({ queryKey: receiptKeys.all }),
    ]),
  });
}
export function useRecordBankPayments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { buildingId: number | null; period: string; entries: BankPaymentEntry[] }) =>
      recordBankPayments(v.buildingId, v.period, v.entries),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: paymentKeys.all }),
      qc.invalidateQueries({ queryKey: receiptKeys.all }),
    ]),
  });
}
export function useRecordGiroPayments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: GiroPaymentEntry[]) => recordGiroPayments(entries),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: paymentKeys.all }),
      qc.invalidateQueries({ queryKey: receiptKeys.all }),
    ]),
  });
}
