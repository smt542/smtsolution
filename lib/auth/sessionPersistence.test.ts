import { describe, it, expect } from "vitest";
import { shouldSignOutOnBoot } from "./sessionPersistence";

describe("shouldSignOutOnBoot", () => {
  it("자동로그인 off + 새 세션 → 로그아웃", () => {
    expect(shouldSignOutOnBoot(false, false)).toBe(true);
  });
  it("자동로그인 off + 기존 탭 세션 → 유지", () => {
    expect(shouldSignOutOnBoot(false, true)).toBe(false);
  });
  it("자동로그인 on → 항상 유지", () => {
    expect(shouldSignOutOnBoot(true, false)).toBe(false);
    expect(shouldSignOutOnBoot(true, true)).toBe(false);
  });
});
