import { describe, it, expect } from "vitest";
import { accountCreateSchema, accountEditSchema } from "./account";

describe("accountCreateSchema", () => {
  it("username·password·fullName·staffType 필수", () => {
    expect(accountCreateSchema.safeParse({ staffType: "manager_staff" }).success).toBe(false);
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "1234", fullName: "김직원", staffType: "manager_staff",
    }).success).toBe(true);
  });
  it("password는 숫자 4자리만 통과", () => {
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "1", fullName: "김", staffType: "manager_staff",
    }).success).toBe(false);
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "12a4", fullName: "김", staffType: "manager_staff",
    }).success).toBe(false);
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "12345", fullName: "김", staffType: "manager_staff",
    }).success).toBe(false);
  });
  it("잘못된 staffType 거부", () => {
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "1234", fullName: "김", staffType: "boss",
    }).success).toBe(false);
  });
});

describe("accountEditSchema", () => {
  it("password 빈칸은 통과하고 입력하면 숫자 4자리만 통과", () => {
    expect(accountEditSchema.safeParse({ fullName: "김직원", staffType: "manager_staff" }).success).toBe(true);
    expect(accountEditSchema.safeParse({
      password: "", fullName: "김직원", staffType: "manager_staff",
    }).success).toBe(true);
    expect(accountEditSchema.safeParse({
      password: "4321", fullName: "김직원", staffType: "manager_staff",
    }).success).toBe(true);
    expect(accountEditSchema.safeParse({
      password: "reset", fullName: "김직원", staffType: "manager_staff",
    }).success).toBe(false);
    expect(accountEditSchema.safeParse({ fullName: "", staffType: "manager_staff" }).success).toBe(false);
  });
});
