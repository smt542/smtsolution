import { describe, it, expect } from "vitest";
import { vendorSchema } from "./vendor";

describe("vendorSchema", () => {
  it("name 필수", () => {
    expect(vendorSchema.safeParse({ name: "" }).success).toBe(false);
    expect(vendorSchema.safeParse({ name: "전기공사" }).success).toBe(true);
  });
});
