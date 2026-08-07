import { describe, it, expect, beforeEach } from "vitest";
import { usernameToEmail } from "./email";

describe("usernameToEmail", () => {
  beforeEach(() => { process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN = "staff.gwanribiseo.app"; });

  it("아이디를 합성 이메일로 변환", () => {
    expect(usernameToEmail("hong")).toBe("hong@staff.gwanribiseo.app");
  });
  it("공백 트림 + 소문자화", () => {
    expect(usernameToEmail("  Hong ")).toBe("hong@staff.gwanribiseo.app");
  });
  it("빈 아이디는 에러", () => {
    expect(() => usernameToEmail("")).toThrow();
  });
});
