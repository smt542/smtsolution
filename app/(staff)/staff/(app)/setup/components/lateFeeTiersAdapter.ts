import type { LateFeeRateTier, LateFeeRateTierInput } from "@/hooks/reactquery/lateFeeTiers";

export const LATE_FEE_TIER_COUNT = 12;

/**
 * `late_fee_rate_tiers`의 구간 표현: `from_month` 미포함 ~ `to_month` 포함,
 * `to_month`가 null이면 위로 열린 구간이다.
 *
 * 열린 구간은 12개월차뿐 아니라 그 앞 개월차도 덮을 수 있다 — 0031의 기본 시드가
 * `(0,1] (1,3] (3,∞)`이라 4~11개월차가 전부 마지막 열린 구간에 속한다. 마지막 칸만
 * 열린 구간을 보게 하면 그 개월들이 0%로 읽히므로, 12개 칸 모두 같은 술어를 쓴다.
 */
function rateForMonth(tiers: readonly LateFeeRateTier[], month: number): number {
  const tier = tiers.find(
    (candidate) =>
      candidate.fromMonth < month &&
      (candidate.toMonth === null || month <= candidate.toMonth),
  );
  return tier?.monthlyRate ?? 0;
}

/** 요율표 구간을 화면의 12칸(1~11개월차 + 12개월차 이후)으로 평탄화한다. */
export function lateFeeTiersToMonthlyRates(tiers: readonly LateFeeRateTier[]): number[] {
  return Array.from({ length: LATE_FEE_TIER_COUNT }, (_, index) =>
    rateForMonth(tiers, index + 1),
  );
}

/**
 * 화면의 12칸을 요율표 12구간으로 만든다.
 * 마지막 칸은 `12개월차 이후`이므로 위로 열린 구간이 된다.
 */
export function monthlyRatesToLateFeeTiers(
  monthlyRates: readonly number[],
): LateFeeRateTierInput[] {
  return Array.from({ length: LATE_FEE_TIER_COUNT }, (_, index) => ({
    tierOrder: index + 1,
    fromMonth: index,
    toMonth: index === LATE_FEE_TIER_COUNT - 1 ? null : index + 1,
    monthlyRate: monthlyRates[index] ?? 0,
  }));
}
