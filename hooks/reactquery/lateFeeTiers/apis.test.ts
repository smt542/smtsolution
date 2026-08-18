import { describe, expect, it } from "vitest";
import { rowToLateFeeRateTier } from "./apis";

describe("lateFeeTiers/apis", () => {
  it("rowToLateFeeRateTier: snake→camel, to_month null 보존", () => {
    expect(
      rowToLateFeeRateTier({
        id: 7,
        org_id: 3,
        tier_order: 2,
        from_month: 1,
        to_month: 3,
        monthly_rate: "1.2000",
      }),
    ).toEqual({
      id: 7,
      orgId: 3,
      tierOrder: 2,
      fromMonth: 1,
      toMonth: 3,
      monthlyRate: 1.2,
    });
    expect(
      rowToLateFeeRateTier({
        id: 8,
        org_id: 3,
        tier_order: 3,
        from_month: 3,
        to_month: null,
        monthly_rate: "1.5000",
      }).toMonth,
    ).toBeNull();
  });
});
