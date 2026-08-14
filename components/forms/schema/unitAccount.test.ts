import { describe, it, expect } from "vitest";
import { unitAccountSchema } from "./unitAccount";
describe("unitAccount schema", () => {
  it("kind enum", () => {
    expect(unitAccountSchema.safeParse({ kind:"mgmt", bank:"국민" }).success).toBe(true);
    expect(unitAccountSchema.safeParse({ kind:"x" }).success).toBe(false);
  });
  it("수납 고객번호를 허용하고 라벨을 제공", () => {
    const value = unitAccountSchema.parse({ kind: "mgmt", payerNo: "PAYER-1" });
    expect(value.payerNo).toBe("PAYER-1");
    expect(unitAccountSchema.shape.payerNo.description).toBe("수납 고객번호");
  });
});
