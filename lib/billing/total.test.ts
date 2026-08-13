import { describe, it, expect } from "vitest";
import { unitTotal, type ChargeLine } from "./total";

const line = (o: Partial<ChargeLine>): ChargeLine =>
  ({ charged: true, amount: 0, dailyProration: false, rounding: "round", ...o });

describe("billing/total", () => {
  it("charged=false 항목 제외", () => {
    const lines = [line({ amount: 10000 }), line({ amount: 5000, charged: false })];
    expect(unitTotal(lines, null, "2026-08-01")).toBe(10000);
  });
  it("일할 항목은 프로레이션 후 합산", () => {
    const lines = [
      line({ amount: 31000, dailyProration: true }), // 16/31 → 16000
      line({ amount: 10000 }),                         // 고정
    ];
    expect(unitTotal(lines, "2026-08-16", "2026-08-01")).toBe(26000);
  });
  it("빈 입력은 0", () => {
    expect(unitTotal([], null, "2026-08-01")).toBe(0);
  });
});
