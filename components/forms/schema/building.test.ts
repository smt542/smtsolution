import { describe, it, expect } from "vitest";
import { buildingSchema } from "./building";

describe("buildingSchema", () => {
  it("code·name 필수", () => {
    expect(buildingSchema.safeParse({ code: "", name: "" }).success).toBe(false);
    expect(buildingSchema.safeParse({ code: "001", name: "그린빌라" }).success).toBe(true);
  });
});
