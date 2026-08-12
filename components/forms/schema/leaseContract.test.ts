import { describe, it, expect } from "vitest";
import { leaseContractSchema } from "./leaseContract";
describe("leaseContract schema", () => {
  it("금액 정수·음수 불가, 전부 optional", () => {
    expect(leaseContractSchema.safeParse({ expiryAlert:false }).success).toBe(true);
    expect(leaseContractSchema.safeParse({ deposit:-1, expiryAlert:false }).success).toBe(false);
    expect(leaseContractSchema.safeParse({ deposit:1000000, monthlyRent:500000, expiryAlert:true }).success).toBe(true);
  });
});
