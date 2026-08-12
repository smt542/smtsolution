import { describe, it, expect } from "vitest";
import { occupancyBasicSchema, occupancyBillingSchema } from "./occupancy";
describe("occupancy schema", () => {
  it("basic: 호실명·이름·입금자명·연락처1·입주일 필수, 룸타입 필수", () => {
    const ok = { unitNo:"101", tenantName:"김", payerName:"김", phone:"010", roomTypeId:1, moveInDate:"2026-01-01" };
    expect(occupancyBasicSchema.safeParse(ok).success).toBe(true);
    expect(occupancyBasicSchema.safeParse({ ...ok, unitNo:"" }).success).toBe(false);
    expect(occupancyBasicSchema.safeParse({ ...ok, phone:"" }).success).toBe(false);
    expect(occupancyBasicSchema.safeParse({ ...ok, roomTypeId:null }).success).toBe(false);
  });
  it("billing: status enum + boolean 플래그", () => {
    expect(occupancyBillingSchema.safeParse({ status:"occupied", billingEnabled:true, printEnabled:true, lateFeeEnabled:true, singlePrint:false }).success).toBe(true);
    expect(occupancyBillingSchema.safeParse({ status:"bad", billingEnabled:true, printEnabled:true, lateFeeEnabled:true, singlePrint:false }).success).toBe(false);
  });
});
