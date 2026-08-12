// components/forms/schema/buildingCustomerNumber.test.ts
import { describe, it, expect } from "vitest";
import { customerNumberSchema } from "./buildingCustomerNumber";
describe("customerNumber schema", () => {
  it("kind enum + customerNo 필수 + meterDay 1..31", () => {
    expect(customerNumberSchema.safeParse({ kind: "water", customerNo: "C1", billingBasis: "current", printOnBill: true }).success).toBe(true);
    expect(customerNumberSchema.safeParse({ kind: "bad", customerNo: "C1", billingBasis: "current", printOnBill: true }).success).toBe(false);
    expect(customerNumberSchema.safeParse({ kind: "water", customerNo: "", billingBasis: "current", printOnBill: true }).success).toBe(false);
    expect(customerNumberSchema.safeParse({ kind: "water", customerNo: "C1", billingBasis: "current", printOnBill: true, meterDay: 32 }).success).toBe(false);
  });
});
