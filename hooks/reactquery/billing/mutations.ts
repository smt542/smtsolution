import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveBillingCharges,
  confirmBilling,
  chargeNewOccupancies,
  saveBillingPeriodSetting,
  type SaveBillingChargesPayload,
  type SaveBillingPeriodSettingPayload,
} from "./apis";
import { billingKeys } from "./keys";

export function useSaveBillingCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveBillingChargesPayload) => saveBillingCharges(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
export function useConfirmBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ buildingId, period }: { buildingId: number; period: string }) => confirmBilling(buildingId, period),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
export function useChargeNewOccupancies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ buildingId, period, unitIds }: { buildingId: number; period: string; unitIds: number[] }) =>
      chargeNewOccupancies(buildingId, period, unitIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
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
