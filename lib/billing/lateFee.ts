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
}

export interface LateFeePeriodResult {
  period: Period;
  months: number;
  cumulativeRatePct: number;
  lateFee: number;
}

export interface LateFeeResult {
  totalLateFee: number;
  byPeriod: LateFeePeriodResult[];
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
): LateFeePeriodResult {
  const months = monthsOverdue(input.dueDate, asOfYear, asOfMonth);
  const cumulativeRatePct = cumulativeRate(tiers, months);
  const lateFee = Math.round(
    (input.unpaidPrincipal * cumulativeRatePct) / 100,
  );

  return { period: input.period, months, cumulativeRatePct, lateFee };
}

export function computeLateFee(
  periods: OverduePeriodInput[],
  tiers: RateTier[],
  asOfYear: number,
  asOfMonth: number,
): LateFeeResult {
  const byPeriod = periods.map((period) =>
    computeLateFeeForPeriod(period, tiers, asOfYear, asOfMonth),
  );
  const totalLateFee = byPeriod.reduce(
    (sum, result) => sum + result.lateFee,
    0,
  );

  return { totalLateFee, byPeriod };
}
