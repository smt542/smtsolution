import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  carryBillingPeriod,
  confirmUtilities,
  saveBillingPeriod,
  saveFixedValues,
  saveScopedPrices,
  saveMeterReadings,
  saveUtilityCustomerBills,
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
  type SaveUtilityCustomerBillsInput,
  type SavePartnerMeterReadingsInput,
  type SaveUtilityUnitPricesInput,
  type SaveUtilitySupplierInput,
  type SaveWaterDiscountInput,
} from "./apis";
import { billingKeys } from "../billing/keys";
import { carryDate } from "@/lib/billing/period";
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

/** 고객번호×월 청구총액 저장 → 서버가 호실 부과액을 배분(0274)하므로 지침·확정 캐시도 갱신한다. */
export function useSaveUtilityCustomerBills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveUtilityCustomerBillsInput) => saveUtilityCustomerBills(input),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({
        queryKey: utilityKeys.customerBills(input.buildingId, input.utilityType, input.period),
      });
      qc.invalidateQueries({
        queryKey: utilityKeys.rows(input.buildingId, input.utilityType, input.period),
      });
      qc.invalidateQueries({
        queryKey: utilityKeys.confirmation(input.buildingId, input.utilityType, input.period),
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

export type CarryUtilityPeriodSummary = {
  carried: number;
  kept: number;
  skipped: number;
  failedCount: number;
  firstError: unknown;
};

/** 공과금 전체 이월: 모든 건물의 부과기준일을 다음 달로 옮긴다(공과금·관리비 부과 세팅 공용 테이블). */
export function useCarryUtilityPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ buildingIds, period }: { buildingIds: number[]; period: string }) => {
      const settled = await Promise.allSettled(
        buildingIds.map((buildingId) => carryBillingPeriod(buildingId, period)),
      );
      const summary: CarryUtilityPeriodSummary = {
        carried: 0, kept: 0, skipped: 0, failedCount: 0, firstError: null,
      };
      for (const item of settled) {
        if (item.status === "rejected") {
          summary.failedCount += 1;
          summary.firstError ??= item.reason;
        } else if (item.value === "carried") summary.carried += 1;
        else if (item.value === "kept") summary.kept += 1;
        else summary.skipped += 1;
      }
      // 전부 실패했을 때만 오류로 던지고, 일부 실패는 호출부가 failedCount 로 안내한다.
      if (settled.length > 0 && summary.failedCount === settled.length) throw summary.firstError;
      return summary;
    },
    onSettled: (_result, _error, input) => {
      const nextPeriod = carryDate(input.period, 1);
      input.buildingIds.forEach((buildingId) => {
        void qc.invalidateQueries({ queryKey: utilityKeys.billingPeriod(buildingId, nextPeriod) });
        void qc.invalidateQueries({ queryKey: billingKeys.periodSetting(buildingId, nextPeriod) });
      });
    },
  });
}
