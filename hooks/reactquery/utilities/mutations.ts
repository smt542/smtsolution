// TODO(p3a): 부과 원장(billing_confirmations) 스키마가 확정되면 계산 결과 확정 mutation을 P5 /management-fee에 추가한다.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveMeterReadings,
  saveWaterDiscount,
  deleteWaterDiscount,
  type SaveMeterReadingsInput,
  type SaveWaterDiscountInput,
} from "./apis";
import { utilityKeys } from "./keys";

export function useSaveMeterReadings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMeterReadingsInput) => saveMeterReadings(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: utilityKeys.all }),
  });
}

export function useSaveWaterDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWaterDiscountInput) => saveWaterDiscount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: utilityKeys.all }),
  });
}

export function useDeleteWaterDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unitId: number) => deleteWaterDiscount(unitId),
    onSuccess: () => qc.invalidateQueries({ queryKey: utilityKeys.all }),
  });
}
