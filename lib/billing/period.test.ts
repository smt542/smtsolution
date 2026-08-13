import { describe, it, expect } from "vitest";
import { currentPeriod, toMonthInput, fromMonthInput, prevPeriod, isFuturePeriod } from "./period";

describe("billing/period", () => {
  it("currentPeriod: 해당월 1일", () => {
    expect(currentPeriod(new Date(2026, 7, 13))).toBe("2026-08-01"); // month는 0-based(7=8월)
  });
  it("toMonthInput / fromMonthInput 왕복", () => {
    expect(toMonthInput("2026-08-01")).toBe("2026-08");
    expect(fromMonthInput("2026-08")).toBe("2026-08-01");
  });
  it("prevPeriod: 1월 전월은 전년 12월", () => {
    expect(prevPeriod("2026-01-01")).toBe("2025-12-01");
    expect(prevPeriod("2026-08-01")).toBe("2026-07-01");
  });
  it("isFuturePeriod: 다음달은 미래", () => {
    const now = new Date(2026, 7, 13);
    expect(isFuturePeriod("2026-09-01", now)).toBe(true);
    expect(isFuturePeriod("2026-08-01", now)).toBe(false);
    expect(isFuturePeriod("2026-07-01", now)).toBe(false);
  });
});
