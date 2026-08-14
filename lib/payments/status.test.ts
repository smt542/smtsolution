import { describe, expect, it } from "vitest";
import { computeUnpaid, derivePayStatus } from "./status";

describe("computeUnpaid", () => {
  it("charged가 null이면 null", () => expect(computeUnpaid(null, 0)).toBeNull());
  it("charged-paid", () => expect(computeUnpaid(10000, 4000)).toBe(6000));
  it("과다수납은 음수", () => expect(computeUnpaid(10000, 12000)).toBe(-2000));
});

describe("derivePayStatus", () => {
  it("미확정(charged null) → unbilled", () => expect(derivePayStatus(null, 0)).toBe("unbilled"));
  it("부과0·수납0 → paid(완납)", () => expect(derivePayStatus(0, 0)).toBe("paid"));
  it("부과0·수납>0 → over", () => expect(derivePayStatus(0, 500)).toBe("over"));
  it("수납0 → unpaid", () => expect(derivePayStatus(10000, 0)).toBe("unpaid"));
  it("부분 → partial", () => expect(derivePayStatus(10000, 4000)).toBe("partial"));
  it("완납 → paid", () => expect(derivePayStatus(10000, 10000)).toBe("paid"));
  it("과다 → over", () => expect(derivePayStatus(10000, 12000)).toBe("over"));
});
