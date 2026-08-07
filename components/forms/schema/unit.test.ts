import { describe, it, expect } from "vitest";
import { unitSchema } from "./unit";

describe("unitSchema", () => {
  it("unitNo 필수", () => {
    expect(unitSchema.safeParse({ unitNo: "" }).success).toBe(false);
    expect(unitSchema.safeParse({ unitNo: "101" }).success).toBe(true);
  });
});
