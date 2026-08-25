import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  issueBills,
  recordBillDelivery,
  sendBillFaxes,
  type IssueBillsPayload,
  type RecordBillDeliveryPayload,
  type SendBillFaxesPayload,
} from "./apis";
import { billKeys } from "./keys";

export function useIssueBills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: IssueBillsPayload) => issueBills(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: billKeys.all }),
  });
}

export function useRecordBillDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: RecordBillDeliveryPayload) => recordBillDelivery(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: billKeys.all }),
  });
}

export function useSendBillFaxes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SendBillFaxesPayload) => sendBillFaxes(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: billKeys.all }),
  });
}
