import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  confirmUtilities,
  saveBillingPeriod,
  saveFixedValues,
  saveScopedPrices,
  saveMeterReadings,
  savePartnerMeterReadings,
  saveUtilityUnitPrices,
  saveUtilitySupplier,
  saveWaterDiscount,
  deleteWaterDiscount,
  type ConfirmUtilitiesInput,
  type SaveBillingPeriodInput,
  type SaveFixedValuesInput,
  type SaveScopedPricesInput,
  type SaveMeterReadingsInput,
  type SavePartnerMeterReadingsInput,
  type SaveUtilityUnitPricesInput,
  type SaveUtilitySupplierInput,
  type SaveWaterDiscountInput,
} from "./apis";
import { utilityKeys } from "./keys";

export interface SaveWaterDiscountMutationInput extends SaveWaterDiscountInput {
  buildingId: number;
  period: string;
}

export interface DeleteWaterDiscountMutationInput {
  buildingId: number;
  period: string;
  unitId: number;
}

export function useSaveMeterReadings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMeterReadingsInput) => saveMeterReadings(input),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({
        queryKey: utilityKeys.rows(input.buildingId, input.utilityType, input.period),
      });
      qc.invalidateQueries({
        queryKey: utilityKeys.confirmation(input.buildingId, input.utilityType, input.period),
      });
      input.rows.forEach((row) => {
        qc.invalidateQueries({
          queryKey: utilityKeys.history(row.unit_id, input.utilityType, input.period),
        });
      });
    },
  });
}

export function useSaveWaterDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWaterDiscountMutationInput) => saveWaterDiscount({
      unitId: input.unitId,
      discountType: input.discountType,
      amount: input.amount,
      memo: input.memo,
    }),
    onSuccess: (_result, input) => qc.invalidateQueries({
      queryKey: utilityKeys.rows(input.buildingId, "water", input.period),
    }),
  });
}

export function useDeleteWaterDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteWaterDiscountMutationInput) => deleteWaterDiscount(input.unitId),
    onSuccess: (_result, input) => qc.invalidateQueries({
      queryKey: utilityKeys.rows(input.buildingId, "water", input.period),
    }),
  });
}

export function useSaveFixedValues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveFixedValuesInput) => saveFixedValues(input),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: utilityKeys.fixedValues(input.buildingId, input.utilityType) });
    },
  });
}

export function useSaveUtilitySupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveUtilitySupplierInput) => saveUtilitySupplier(input),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({
        queryKey: utilityKeys.supplier(input.buildingId, input.utilityType),
      });
    },
  });
}

export function useSaveBillingPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveBillingPeriodInput) => saveBillingPeriod(input),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({
        queryKey: utilityKeys.billingPeriod(input.buildingId, input.period),
      });
    },
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

export function useSaveScopedPrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveScopedPricesInput) =>
      saveScopedPrices(input.buildingId, input.utilityType, input.rows),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({
        queryKey: utilityKeys.scopedPrices(input.buildingId, input.utilityType),
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

export function useSavePartnerMeterReadings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavePartnerMeterReadingsInput) =>
      savePartnerMeterReadings(input),
    onSuccess: async (_result, input) => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: utilityKeys.partnerMeter(input.buildingId, input.period),
        }),
        ...(["water", "electricity", "gas"] as const).map((utilityType) =>
          qc.invalidateQueries({
            queryKey: utilityKeys.rowsScope(input.buildingId, utilityType),
          }),
        ),
      ]);
    },
  });
}
