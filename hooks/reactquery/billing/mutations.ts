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
import { billKeys } from "../bill/keys";
import { billingKeys } from "./keys";
import { utilityKeys } from "../utilities/keys";

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

export interface CopyPreviousBillingSummary {
  buildingCount: number;
  unitCount: number;
  chargeCount: number;
  failedCount: number;
  firstError: unknown;
}

export function useCopyPreviousBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ buildingIds, period }: { buildingIds: number[]; period: string }) => {
      const settled = await Promise.allSettled(
        buildingIds.map((buildingId) => copyPreviousBilling(buildingId, period)),
      );
      const summary: CopyPreviousBillingSummary = {
        buildingCount: 0, unitCount: 0, chargeCount: 0, failedCount: 0, firstError: null,
      };
      for (const item of settled) {
        if (item.status === "rejected") {
          summary.failedCount += 1;
          summary.firstError ??= item.reason;
          continue;
        }
        // 금액이 아니라 기준일만 이월된 건물도 반영 건물로 센다.
        if (item.value.unitCount > 0 || item.value.settingCarried) summary.buildingCount += 1;
        summary.unitCount += item.value.unitCount;
        summary.chargeCount += item.value.chargeCount;
      }
      // 전부 실패했을 때만 오류로 던지고, 일부 실패는 호출부가 failedCount 로 안내한다.
      if (settled.length > 0 && summary.failedCount === settled.length) throw summary.firstError;
      return summary;
    },
    onSettled: (_result, _error, input) => {
      input.buildingIds.forEach((buildingId) => {
        void qc.invalidateQueries({ queryKey: billingKeys.list(buildingId, input.period) });
        void qc.invalidateQueries({ queryKey: billingKeys.periodSetting(buildingId, input.period) });
        void qc.invalidateQueries({ queryKey: utilityKeys.billingPeriod(buildingId, input.period) });
      });
      // 이월한 납부일이 세대별 납부 마감일(발행·미납 화면)에도 반영되게 한다.
      void qc.invalidateQueries({ queryKey: [...billKeys.all, "due-dates", input.period] });
    },
  });
}
