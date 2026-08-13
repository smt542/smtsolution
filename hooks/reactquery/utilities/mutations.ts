import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  confirmUtilities,
  saveMeterReadings,
  saveUtilityUnitPrices,
  saveWaterDiscount,
  deleteWaterDiscount,
  type ConfirmUtilitiesInput,
  type SaveMeterReadingsInput,
  type SaveUtilityUnitPricesInput,
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

export function useSaveUtilityUnitPrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveUtilityUnitPricesInput) => saveUtilityUnitPrices(input),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({
        queryKey: utilityKeys.prices(input.buildingId, input.utilityType),
      });
      qc.invalidateQueries({
        queryKey: utilityKeys.rowsScope(input.buildingId, input.utilityType),
      });
    },
  });
}

export function useConfirmUtilities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmUtilitiesInput) => confirmUtilities(input),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({
        queryKey: utilityKeys.confirmation(
          input.buildingId,
          input.utilityType,
          input.period,
        ),
      });
      qc.invalidateQueries({
        queryKey: utilityKeys.rows(input.buildingId, input.utilityType, input.period),
      });
    },
  });
}
