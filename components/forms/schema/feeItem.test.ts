import { describe, it, expect } from "vitest";
import { feeItemSchema } from "./feeItem";

describe("feeItemSchema", () => {
  it("name 필수, rounding/dailyProration/carryOver 기본값", () => {
    expect(feeItemSchema.safeParse({ name: "" }).success).toBe(false);
    expect(feeItemSchema.safeParse({ name: "수도료" }).success).toBe(true);
    const parsed = feeItemSchema.safeParse({ name: "수도료" });
    if (parsed.success) {
      expect(parsed.data.rounding).toBe("round");
      expect(parsed.data.dailyProration).toBe(false);
      expect(parsed.data.carryOver).toBe(false);
    }
  });
});
