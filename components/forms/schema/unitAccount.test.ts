import { describe, it, expect } from "vitest";
import { unitAccountSchema } from "./unitAccount";
describe("unitAccount schema", () => {
  it("kind enum", () => {
    expect(unitAccountSchema.safeParse({ kind:"mgmt", bank:"국민" }).success).toBe(true);
    expect(unitAccountSchema.safeParse({ kind:"x" }).success).toBe(false);
  });
});
