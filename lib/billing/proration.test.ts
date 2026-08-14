import { describe, it, expect } from "vitest";
import { roundCharge, daysInMonth, occupiedDays, effectiveAmount } from "./proration";

describe("billing/proration", () => {
  it("roundCharge: 10원 단위, raw는 미적용", () => {
    expect(roundCharge(12345, "round")).toBe(12350); // 끝자리 5 → 올림
    expect(roundCharge(12342, "round")).toBe(12340); // 끝자리 1~4 → 버림
    expect(roundCharge(12341, "up")).toBe(12350); // 무조건 10원 올림
    expect(roundCharge(12349, "down")).toBe(12340); // 무조건 10원 내림
    expect(roundCharge(12345.6, "raw")).toBe(12345.6); // 그대로(미적용)
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
  it("effectiveAmount: 일할+중간입주 → 분모 고정 30일 프로레이션", () => {
    // 계산규칙 1.1: 31000 * 16/30 = 16533.3 → 4사5입(10원) = 16530
    expect(effectiveAmount(31000, { dailyProration: true, rounding: "round" }, "2026-08-16", "2026-08-01")).toBe(16530);
  });
  it("effectiveAmount: 일할이지만 그 달 전체 거주 → 원액", () => {
    expect(effectiveAmount(31000, { dailyProration: true, rounding: "round" }, "2026-07-01", "2026-08-01")).toBe(31000);
  });
});
