import { describe, it, expect } from "vitest";
import { accountCreateSchema, accountEditSchema } from "./account";

describe("accountCreateSchema", () => {
  it("username·password·fullName·staffType 필수", () => {
    expect(accountCreateSchema.safeParse({ staffType: "manager_staff" }).success).toBe(false);
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "pw12", fullName: "김직원", staffType: "manager_staff",
    }).success).toBe(true);
  });
  it("password 4자 미만 실패", () => {
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "1", fullName: "김", staffType: "manager_staff",
    }).success).toBe(false);
  });
  it("잘못된 staffType 거부", () => {
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "pw12", fullName: "김", staffType: "boss",
    }).success).toBe(false);
  });
});

describe("accountEditSchema", () => {
  it("username/password 없이도 통과(fullName 필수)", () => {
    expect(accountEditSchema.safeParse({ fullName: "김직원", staffType: "manager_staff" }).success).toBe(true);
    expect(accountEditSchema.safeParse({ fullName: "", staffType: "manager_staff" }).success).toBe(false);
  });
});
