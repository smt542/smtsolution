import { describe, it, expect } from "vitest";
import { occupancySchema } from "./occupancy";

describe("occupancySchema", () => {
  it("모든 필드 optional, status 기본 'occupied'", () => {
    expect(occupancySchema.safeParse({}).success).toBe(true);
    expect(occupancySchema.safeParse({ status: "vacant" }).success).toBe(true);
    const parsed = occupancySchema.safeParse({});
    expect(parsed.success && parsed.data.status).toBe("occupied");
  });
});
