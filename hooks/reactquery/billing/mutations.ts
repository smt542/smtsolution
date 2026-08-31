import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveBillingCharges,
  confirmBilling,
  chargeNewOccupancies,
  saveBillingPeriodSetting,
  copyPreviousBilling,
  type SaveBillingChargesPayload,
  type SaveBillingPeriodSettingPayload,
} from "./apis";
import { billingKeys } from "./keys";

export function useSaveBillingCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveBillingChargesPayload) => saveBillingCharges(p),
    onSuccess: (_result, input) => qc.invalidateQueries({
      queryKey: billingKeys.list(input.buildingId, input.period),
    }),
  });
}
export function useConfirmBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ buildingId, period }: { buildingId: number; period: string }) => confirmBilling(buildingId, period),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: billingKeys.list(input.buildingId, input.period) });
      qc.invalidateQueries({ queryKey: billingKeys.histories() });
      qc.invalidateQueries({ queryKey: billingKeys.newOccupancies(input.buildingId, input.period) });
    },
  });
}
export function useChargeNewOccupancies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ buildingId, period, unitIds }: { buildingId: number; period: string; unitIds: number[] }) =>
      chargeNewOccupancies(buildingId, period, unitIds),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: billingKeys.list(input.buildingId, input.period) });
      qc.invalidateQueries({ queryKey: billingKeys.newOccupancies(input.buildingId, input.period) });
      input.unitIds.forEach((unitId) => {
        qc.invalidateQueries({ queryKey: billingKeys.history(unitId, input.period) });
      });
    },
  });
}
export function useSaveBillingPeriodSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveBillingPeriodSettingPayload) => saveBillingPeriodSetting(payload),
    onSuccess: (setting) => {
      qc.setQueryData(
        billingKeys.periodSetting(setting.buildingId, setting.period),
        setting,
      );
    },
  });
}

export function useCopyPreviousBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ buildingIds, period }: { buildingIds: number[]; period: string }) => {
      const results = await Promise.all(
        buildingIds.map((buildingId) => copyPreviousBilling(buildingId, period)),
      );
      return results.reduce<{ buildingCount: number; unitCount: number; chargeCount: number }>(
        (total, result) => ({
          buildingCount: total.buildingCount + (result.unitCount > 0 ? 1 : 0),
          unitCount: total.unitCount + result.unitCount,
          chargeCount: total.chargeCount + result.chargeCount,
        }),
        { buildingCount: 0, unitCount: 0, chargeCount: 0 },
      );
    },
    onSuccess: (_result, input) => {
      input.buildingIds.forEach((buildingId) => {
        void qc.invalidateQueries({ queryKey: billingKeys.list(buildingId, input.period) });
        void qc.invalidateQueries({ queryKey: billingKeys.periodSetting(buildingId, input.period) });
      });
    },
  });
}
