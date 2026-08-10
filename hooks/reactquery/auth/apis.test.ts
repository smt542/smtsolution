import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword, signOut }, rpc }),
}));

import { login, getMyContext } from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN = "staff.gwanribiseo.app";
});

describe("login", () => {
  it("회사코드+아이디를 합성 이메일로 바꿔 signInWithPassword 호출", async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: null });
    await login({ companyCode: "demo", username: "hong", password: "pw", autoLogin: false });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "demo.hong@staff.gwanribiseo.app", password: "pw",
    });
  });
  it("실패 시 일반 메시지로 throw", async () => {
    signInWithPassword.mockResolvedValue({ data: null, error: { message: "Invalid" } });
    await expect(login({ companyCode: "demo", username: "hong", password: "x", autoLogin: false }))
      .rejects.toThrow("아이디 또는 비밀번호가 올바르지 않습니다.");
  });
});

describe("getMyContext", () => {
  it("rpc 결과 첫 행을 카멜케이스로 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      org_id: 1, role: "staff", org_status: "active",
      username: "hong", full_name: "홍길동", is_active: true, must_change_password: false,
    }], error: null });
    const ctx = await getMyContext();
    expect(ctx).toEqual({
      orgId: 1, role: "staff", orgStatus: "active",
      username: "hong", fullName: "홍길동", isActive: true, mustChangePassword: false,
    });
  });
  it("결과 없으면 null", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getMyContext()).toBeNull();
  });
});
