import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  completeMovingSettlement,
  deletePartnerMovingSettlement,
  deleteMovingSettlement,
  midMoveoutSettlement,
  saveMovingSettlement,
  savePartnerMovingSettlement,
  updateSettlementInquiryRows,
  type SaveSettlementInput,
  type SavePartnerSettlementInput,
  type UpdateSettlementInquiryRow,
} from "./apis";
import { movingSettlementKeys } from "./keys";

export function useSaveSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveSettlementInput) => saveMovingSettlement(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}

export function useCompleteSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => completeMovingSettlement(settlementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}

export function useMidMoveout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => midMoveoutSettlement(settlementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}

export function useUpdateSettlementInquiryRows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: UpdateSettlementInquiryRow[]) =>
      updateSettlementInquiryRows(rows),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}

export function useDeleteSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => deleteMovingSettlement(settlementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}

export function useSavePartnerSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavePartnerSettlementInput) =>
      savePartnerMovingSettlement(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}

export function useDeletePartnerSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) =>
      deletePartnerMovingSettlement(settlementId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}
