import { describe, it, expect } from "vitest";
import { loginSchema } from "./auth";

describe("loginSchema", () => {
  it("정상 입력 통과", () => {
    const r = loginSchema.safeParse({ companyCode: "demo", username: "hong", password: "pw123456", autoLogin: true });
    expect(r.success).toBe(true);
  });
  it("빈 회사코드 실패 메시지", () => {
    const r = loginSchema.safeParse({ companyCode: "", username: "hong", password: "x", autoLogin: false });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("회사코드를 입력해 주세요");
  });
  it("빈 아이디 실패 메시지", () => {
    const r = loginSchema.safeParse({ companyCode: "demo", username: "", password: "x", autoLogin: false });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("아이디를 입력해 주세요");
  });
  it("autoLogin 기본값 false", () => {
    const r = loginSchema.parse({ companyCode: "demo", username: "a", password: "b" });
    expect(r.autoLogin).toBe(false);
  });
});
