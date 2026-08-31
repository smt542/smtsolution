import { describe, expect, it } from "vitest";
import { customerNumberSchema } from "./buildingCustomerNumber";

const valid = {
  kind: "water",
  customerNo: "C1",
  billingBasis: "current",
  calculationMethod: "auto",
  printOnBill: true,
};

describe("customerNumber schema", () => {
  it("유형, 고객번호, 일금일 1~28, 계산 방식을 검증한다", () => {
    expect(customerNumberSchema.safeParse(valid).success).toBe(true);
    expect(customerNumberSchema.safeParse({ ...valid, kind: "bad" }).success).toBe(false);
    expect(customerNumberSchema.safeParse({ ...valid, customerNo: "" }).success).toBe(false);
    expect(customerNumberSchema.safeParse({ ...valid, meterDay: 29 }).success).toBe(false);
    expect(customerNumberSchema.safeParse({ ...valid, calculationMethod: "batch" }).success).toBe(false);
  });
});
