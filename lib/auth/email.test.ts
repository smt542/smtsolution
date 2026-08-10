import { describe, it, expect, beforeEach } from "vitest";
import { loginEmail } from "./email";

describe("loginEmail", () => {
  beforeEach(() => { process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN = "staff.gwanribiseo.app"; });

  it("회사코드+아이디를 합성 이메일로 변환", () => {
    expect(loginEmail("demo", "hong")).toBe("demo.hong@staff.gwanribiseo.app");
  });
  it("공백 트림 + 소문자화", () => {
    expect(loginEmail("  Demo ", "  Hong ")).toBe("demo.hong@staff.gwanribiseo.app");
  });
  it("빈 회사코드는 에러", () => {
    expect(() => loginEmail("", "hong")).toThrow();
  });
  it("빈 아이디는 에러", () => {
    expect(() => loginEmail("demo", "")).toThrow();
  });
});
