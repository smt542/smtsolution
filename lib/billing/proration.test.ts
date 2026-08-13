import { describe, it, expect } from "vitest";
import { roundCharge, daysInMonth, occupiedDays, effectiveAmount } from "./proration";

describe("billing/proration", () => {
  it("roundCharge: up/round/down/raw", () => {
    expect(roundCharge(100.4, "up")).toBe(101);
    expect(roundCharge(100.4, "round")).toBe(100);
    expect(roundCharge(100.6, "round")).toBe(101);
    expect(roundCharge(100.9, "down")).toBe(100);
    expect(roundCharge(100.6, "raw")).toBe(101); // raw = 반올림
  });
  it("daysInMonth", () => {
    expect(daysInMonth("2026-02-01")).toBe(28);
    expect(daysInMonth("2026-08-01")).toBe(31);
    expect(daysInMonth("2024-02-01")).toBe(29); // 윤년
  });
  it("occupiedDays: 중간입주는 입주일 포함, 아니면 월 전체", () => {
    expect(occupiedDays("2026-08-16", "2026-08-01")).toBe(16); // 16~31 = 16일
    expect(occupiedDays("2026-07-20", "2026-08-01")).toBe(31); // 전월 입주 → 전체
    expect(occupiedDays(null, "2026-08-01")).toBe(31);
  });
  it("effectiveAmount: 비일할 항목은 원액", () => {
    expect(effectiveAmount(30000, { dailyProration: false, rounding: "round" }, "2026-08-16", "2026-08-01")).toBe(30000);
  });
  it("effectiveAmount: 일할+중간입주 → 프로레이션", () => {
    // 31000 * 16/31 = 16000
    expect(effectiveAmount(31000, { dailyProration: true, rounding: "round" }, "2026-08-16", "2026-08-01")).toBe(16000);
  });
  it("effectiveAmount: 일할이지만 그 달 전체 거주 → 원액", () => {
    expect(effectiveAmount(31000, { dailyProration: true, rounding: "round" }, "2026-07-01", "2026-08-01")).toBe(31000);
  });
});
