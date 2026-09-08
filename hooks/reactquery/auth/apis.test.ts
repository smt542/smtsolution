import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut }, rpc }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { getMyContext, login } from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("login", () => {
  const context = {
    orgId: 1,
    role: "staff",
    orgStatus: "active",
    username: "hong",
    fullName: "홍길동",
    isActive: true,
    mustChangePassword: false,
    staffType: "manager_staff",
    permissions: ["buildings"],
  };

  it("아이디와 비밀번호만 staff 로그인 API로 보내고 컨텍스트를 반환한다", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(context),
    });

    await expect(login({ username: "hong", password: "pw", autoLogin: true })).resolves.toEqual(context);
    expect(fetchMock).toHaveBeenCalledWith("/api/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "hong", password: "pw" }),
    });
  });

  it("서버 로그인 오류 메시지를 그대로 전달한다", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }),
    });

    await expect(login({ username: "hong", password: "wrong", autoLogin: false }))
      .rejects.toThrow("아이디 또는 비밀번호가 올바르지 않습니다.");
  });
});

describe("getMyContext", () => {
  it("rpc 결과 첫 행을 카멜케이스로 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      org_id: 1, role: "staff", org_status: "active",
      username: "hong", full_name: "홍길동", is_active: true, must_change_password: false,
      staff_type: "manager_staff", permissions: ["buildings"], staff_capabilities: ["manager_staff"],
    }], error: null });
    const ctx = await getMyContext();
    expect(ctx).toEqual({
      orgId: 1, role: "staff", orgStatus: "active",
      username: "hong", fullName: "홍길동", isActive: true, mustChangePassword: false,
      staffType: "manager_staff", staffCapabilities: ["manager_staff"], permissions: ["buildings"],
    });
  });

  it("결과 없으면 null", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getMyContext()).toBeNull();
  });
});
