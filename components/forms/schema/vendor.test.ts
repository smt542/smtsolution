import { describe, it, expect } from "vitest";
import { vendorSchema } from "./vendor";

describe("vendorSchema", () => {
  it("이름과 분류를 필수로 검증하고 빈 선택을 거부한다", () => {
    expect(vendorSchema.safeParse({ name: "", categoryId: 1 }).success).toBe(false);
    expect(vendorSchema.safeParse({ name: "전기공사", categoryId: null }).success).toBe(false);
    expect(vendorSchema.safeParse({
      name: " 전기공사 ",
      phone: "",
      bankAccount: "",
      memo: "",
      categoryId: 1,
    })).toMatchObject({
      success: true,
      data: expect.objectContaining({
        name: "전기공사",
        phone: null,
        bankAccount: null,
        memo: null,
        categoryId: 1,
      }),
    });
  });
});
