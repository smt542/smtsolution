import { describe, expect, it } from "vitest";
import {
  computeLateFee,
  computeLateFeeForPeriod,
  cumulativeRate,
  monthsOverdue,
  rateForMonth,
  type RateTier,
} from "./lateFee";

const TIERS: RateTier[] = [
  { fromMonth: 0, toMonth: 1, monthlyRate: 1.0 },
  { fromMonth: 1, toMonth: 3, monthlyRate: 1.2 },
  { fromMonth: 3, toMonth: null, monthlyRate: 1.5 },
];

describe("billing/lateFee", () => {
  it("rateForMonth: from exclusive · to inclusive · null 상한", () => {
    expect(rateForMonth(TIERS, 1)).toBe(1.0);
    expect(rateForMonth(TIERS, 2)).toBe(1.2);
    expect(rateForMonth(TIERS, 3)).toBe(1.2);
    expect(rateForMonth(TIERS, 4)).toBe(1.5);
    expect(rateForMonth(TIERS, 0)).toBe(0);
    expect(rateForMonth([], 5)).toBe(0);
  });

  it("cumulativeRate: 누적 요율 합", () => {
    expect(cumulativeRate(TIERS, 0)).toBe(0);
    expect(cumulativeRate(TIERS, 1)).toBeCloseTo(1.0);
    expect(cumulativeRate(TIERS, 3)).toBeCloseTo(3.4);
  });

  it("monthsOverdue: 월 단위 차이, 음수/동월은 0", () => {
    expect(monthsOverdue("2026-03-31", 2026, 6)).toBe(3);
    expect(monthsOverdue("2026-06-30", 2026, 6)).toBe(0);
    expect(monthsOverdue("2026-08-31", 2026, 6)).toBe(0);
    expect(monthsOverdue("2025-12-31", 2026, 2)).toBe(2);
  });

  it("computeLateFeeForPeriod: 예시 3,400원", () => {
    const result = computeLateFeeForPeriod(
      {
        period: "2026-03-01",
        unpaidPrincipal: 100_000,
        dueDate: "2026-03-31",
      },
      TIERS,
      2026,
      6,
    );

    expect(result.months).toBe(3);
    expect(result.cumulativeRatePct).toBeCloseTo(3.4);
    expect(result.lateFee).toBe(3_400);
  });

  it("computeLateFee: 다중 period 합산 + 빈 요율표는 0", () => {
    const periods = [
      {
        period: "2026-03-01",
        unpaidPrincipal: 100_000,
        dueDate: "2026-03-31",
      },
      {
        period: "2026-05-01",
        unpaidPrincipal: 50_000,
        dueDate: "2026-05-31",
      },
    ];
    const total = computeLateFee(periods, TIERS, 2026, 6);

    expect(total.totalLateFee).toBe(3_900);
    expect(total.byPeriod).toHaveLength(2);
    expect(computeLateFee(periods, [], 2026, 6).totalLateFee).toBe(0);
  });
});
