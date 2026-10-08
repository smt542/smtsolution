import type { Period } from "@/lib/billing/period";

export interface RateTier {
  fromMonth: number;
  toMonth: number | null;
  monthlyRate: number;
}

export interface OverduePeriodInput {
  period: Period;
  unpaidPrincipal: number;
  dueDate: string;
  /** 입주(세대)별 연체료 부과 여부(occupancies.late_fee_enabled). false 면 연체료·납기후 가산금 모두 0. 생략 시 부과. */
  lateFeeEnabled?: boolean;
}

export interface LateFeePeriodResult {
  period: Period;
  months: number;
  cumulativeRatePct: number;
  /** 월차별 구간 요율로 계산한 연체료("납.연체료"). */
  lateFee: number;
  /** 납기후 가산금("납.후연체"). 월차와 무관한 정률이라 따로 둔다. */
  postDueFee: number;
}

export interface LateFeeResult {
  totalLateFee: number;
  totalPostDueFee: number;
  byPeriod: LateFeePeriodResult[];
}

/**
 * 납기후 가산율 기본값(%). DB `setup_config.late_fee_post_due_rate` 기본값과 같다.
 * 설정을 아직 불러오지 못했을 때만 쓰고, 불러왔으면 `LateFeeSettings.postDueRatePct`를 쓴다.
 */
export const POST_DUE_FEE_RATE_PCT = 2;

/** 조직 연체료 설정(setup_config). 생략하면 연체료 사용 + 기본 가산율로 계산한다. */
export interface LateFeeSettings {
  /** setup_config.late_fee_enabled — false 면 연체료·납기후 가산금 모두 0. */
  enabled: boolean;
  /** setup_config.late_fee_post_due_rate(%). */
  postDueRatePct: number;
}

/** 연체 k개월차(k>=1)에 적용할 월요율(%). from < k <= to (to null=무한). 없으면 0. */
export function rateForMonth(tiers: RateTier[], k: number): number {
  if (k <= 0) return 0;

  for (const tier of tiers) {
    const afterFrom = k > tier.fromMonth;
    const beforeTo = tier.toMonth === null || k <= tier.toMonth;
    if (afterFrom && beforeTo) return tier.monthlyRate;
  }

  return 0;
}

/** 연체 n개월 누적 요율(%) = Σ_{k=1..n} rateForMonth(k). */
export function cumulativeRate(tiers: RateTier[], n: number): number {
  let sum = 0;
  for (let k = 1; k <= n; k += 1) {
    sum += rateForMonth(tiers, k);
  }
  return sum;
}

/** 납기일부터 기준월(asOf) 말까지의 연체 개월수(월 단위, 음수→0). */
export function monthsOverdue(
  dueDate: string,
  asOfYear: number,
  asOfMonth: number,
): number {
  const [dueYear, dueMonth] = dueDate.split("-").map(Number);
  const difference = (asOfYear - dueYear) * 12 + (asOfMonth - dueMonth);
  return difference > 0 ? difference : 0;
}

export function computeLateFeeForPeriod(
  input: OverduePeriodInput,
  tiers: RateTier[],
  asOfYear: number,
  asOfMonth: number,
  settings?: LateFeeSettings,
): LateFeePeriodResult {
  const months = monthsOverdue(input.dueDate, asOfYear, asOfMonth);
  if ((settings && !settings.enabled) || input.lateFeeEnabled === false) {
    return { period: input.period, months, cumulativeRatePct: 0, lateFee: 0, postDueFee: 0 };
  }
  const cumulativeRatePct = cumulativeRate(tiers, months);
  const lateFee = Math.round(
    (input.unpaidPrincipal * cumulativeRatePct) / 100,
  );
  // 납기후 가산금("납.후연체"). 월차와 무관한 정률이라 구간 요율과 따로 계산한다.
  const postDueRatePct = settings?.postDueRatePct ?? POST_DUE_FEE_RATE_PCT;
  const postDueFee = Math.round(
    (input.unpaidPrincipal * postDueRatePct) / 100 / 10,
  ) * 10;

  return { period: input.period, months, cumulativeRatePct, lateFee, postDueFee };
}

export function computeLateFee(
  periods: OverduePeriodInput[],
  tiers: RateTier[],
  asOfYear: number,
  asOfMonth: number,
  settings?: LateFeeSettings,
): LateFeeResult {
  const byPeriod = periods.map((period) =>
    computeLateFeeForPeriod(period, tiers, asOfYear, asOfMonth, settings),
  );
  const totalLateFee = byPeriod.reduce((sum, result) => sum + result.lateFee, 0);
  const totalPostDueFee = byPeriod.reduce((sum, result) => sum + result.postDueFee, 0);

  return { totalLateFee, totalPostDueFee, byPeriod };
}
