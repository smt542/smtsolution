import { useMutation, useQueryClient } from "@tanstack/react-query";
import { billKeys } from "@/hooks/reactquery/bill/keys";
import { billingKeys } from "@/hooks/reactquery/billing/keys";
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
      // 고지서 이월 미납·연체료(get_bill_documents)는 수납에 따라 바뀐다.
      qc.invalidateQueries({ queryKey: billKeys.all }),
      // 관리비 부과 세팅의 전월과수납 미리보기(list_billing)는 과수납 원장에 따라 바뀐다(QA #31).
      qc.invalidateQueries({ queryKey: billingKeys.all }),
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
      // 고지서 이월 미납·연체료(get_bill_documents)는 수납에 따라 바뀐다.
      qc.invalidateQueries({ queryKey: billKeys.all }),
      // 관리비 부과 세팅의 전월과수납 미리보기(list_billing)는 과수납 원장에 따라 바뀐다(QA #31).
      qc.invalidateQueries({ queryKey: billingKeys.all }),
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
      // 고지서 이월 미납·연체료(get_bill_documents)는 수납에 따라 바뀐다.
      qc.invalidateQueries({ queryKey: billKeys.all }),
      // 관리비 부과 세팅의 전월과수납 미리보기(list_billing)는 과수납 원장에 따라 바뀐다(QA #31).
      qc.invalidateQueries({ queryKey: billingKeys.all }),
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
      // 고지서 이월 미납·연체료(get_bill_documents)는 수납에 따라 바뀐다.
      qc.invalidateQueries({ queryKey: billKeys.all }),
      // 관리비 부과 세팅의 전월과수납 미리보기(list_billing)는 과수납 원장에 따라 바뀐다(QA #31).
      qc.invalidateQueries({ queryKey: billingKeys.all }),
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
      // 고지서 이월 미납·연체료(get_bill_documents)는 수납에 따라 바뀐다.
      qc.invalidateQueries({ queryKey: billKeys.all }),
      // 관리비 부과 세팅의 전월과수납 미리보기(list_billing)는 과수납 원장에 따라 바뀐다(QA #31).
      qc.invalidateQueries({ queryKey: billingKeys.all }),
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
      // 고지서 이월 미납·연체료(get_bill_documents)는 수납에 따라 바뀐다.
      qc.invalidateQueries({ queryKey: billKeys.all }),
      // 관리비 부과 세팅의 전월과수납 미리보기(list_billing)는 과수납 원장에 따라 바뀐다(QA #31).
      qc.invalidateQueries({ queryKey: billingKeys.all }),
    ]),
  });
}
