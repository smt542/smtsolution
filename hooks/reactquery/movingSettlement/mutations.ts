import { useMutation, useQueryClient } from "@tanstack/react-query";
import { occupancyKeys } from "@/hooks/reactquery/occupancies/keys";
import {
  cancelMovingSettlementMoveout,
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

/** 퇴실 취소 — 입주 정보가 되살아나므로 입주자 목록(수신자 선택 등)도 다시 읽는다. */
export function useCancelMoveout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => cancelMovingSettlementMoveout(settlementId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: movingSettlementKeys.all });
      void qc.invalidateQueries({ queryKey: occupancyKeys.all });
    },
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
