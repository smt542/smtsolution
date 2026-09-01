import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  completeMovingSettlement,
  deleteMovingSettlement,
  midMoveoutSettlement,
  saveMovingSettlement,
  type SaveSettlementInput,
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

export function useDeleteSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => deleteMovingSettlement(settlementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}
