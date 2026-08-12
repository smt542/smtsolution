// components/forms/schema/buildingVendor.test.ts
import { describe, it, expect } from "vitest";
import { buildingVendorSchema } from "./buildingVendor";
describe("buildingVendor schema", () => {
  it("vendorType enum + name 필수", () => {
    expect(buildingVendorSchema.safeParse({ vendorType: "elevator", name: "업체" }).success).toBe(true);
    expect(buildingVendorSchema.safeParse({ vendorType: "x", name: "업체" }).success).toBe(false);
    expect(buildingVendorSchema.safeParse({ vendorType: "elevator", name: "" }).success).toBe(false);
  });
});
