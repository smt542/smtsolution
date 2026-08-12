import { describe, it, expect } from "vitest";
import { unitMeterSchema } from "./unitMeter";
describe("unitMeter schema", () => {
  it("utility enum", () => {
    expect(unitMeterSchema.safeParse({ utility:"water", meterNo:"M", customerNo:"C" }).success).toBe(true);
    expect(unitMeterSchema.safeParse({ utility:"x" }).success).toBe(false);
  });
});
