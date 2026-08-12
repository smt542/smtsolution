// components/forms/schema/building.test.ts
import { describe, it, expect } from "vitest";
import { buildingBasicSchema, facilitiesSchema } from "./building";

describe("building schema", () => {
  it("basic: name·address 필수, 담당자 uuid|null 허용", () => {
    expect(buildingBasicSchema.safeParse({ name: "가나빌", address: "서울", memo: "" }).success).toBe(true);
    expect(buildingBasicSchema.safeParse({ name: "", address: "서울" }).success).toBe(false);
    expect(buildingBasicSchema.safeParse({ name: "가나빌", address: "" }).success).toBe(false);
    expect(buildingBasicSchema.safeParse({ name: "가나빌", address: "서울", managerUserId: null }).success).toBe(true);
  });
  it("basic: memo 1000자 초과 거부", () => {
    expect(buildingBasicSchema.safeParse({ name: "n", address: "a", memo: "가".repeat(1001) }).success).toBe(false);
  });
  it("facilities: 9키 각 {on,memo}", () => {
    const ok = Object.fromEntries(
      ["cctv","elevator","cleaning","metering","management","septic","internet","electric_safety","fire_safety"]
        .map((k) => [k, { on: false, memo: "" }]));
    expect(facilitiesSchema.safeParse(ok).success).toBe(true);
  });
});
