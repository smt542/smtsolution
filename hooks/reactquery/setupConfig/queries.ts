import { useQuery } from "@tanstack/react-query";
import type { LateFeeSettings } from "@/lib/billing/lateFee";
import { getSetupConfig, type SetupConfig } from "./apis";
import { setupConfigKeys } from "./keys";
export function useSetupConfig(orgId?: number) {
  return useQuery({ queryKey: setupConfigKeys.detail(orgId), queryFn: () => getSetupConfig(orgId as number), enabled: !!orgId });
}

const toLateFeeSettings = (config: SetupConfig | null): LateFeeSettings | null =>
  config ? { enabled: config.lateFeeEnabled, postDueRatePct: config.lateFeePostDueRate } : null;

/**
 * 조직 연체료 설정(사용 여부·납기후 가산율). useSetupConfig 와 같은 캐시를 쓴다.
 * 아직 못 불러왔거나 설정 행이 없으면 undefined — 계산부는 기본값(사용·2%)으로 처리한다.
 */
export function useLateFeeSettings(orgId?: number | null): LateFeeSettings | undefined {
  const { data } = useQuery({
    queryKey: setupConfigKeys.detail(orgId ?? undefined),
    queryFn: () => getSetupConfig(orgId as number),
    enabled: !!orgId,
    select: toLateFeeSettings,
  });
  return data ?? undefined;
}
