import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
  profileSelect: vi.fn(),
  profileEq: vi.fn(),
  membershipSelect: vi.fn(),
  membershipIn: vi.fn(),
  membershipRoleEq: vi.fn(),
  getUserById: vi.fn(),
  signInWithPassword: vi.fn(),
  adminRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "./route";

function request(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/platform/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return { select: mocks.profileSelect };
    }
    if (table === "org_members") {
      return { select: mocks.membershipSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.profileSelect.mockReturnValue({ eq: mocks.profileEq });
  mocks.membershipSelect.mockReturnValue({ in: mocks.membershipIn });
  mocks.membershipIn.mockReturnValue({ eq: mocks.membershipRoleEq });
  mocks.createAdminClient.mockReturnValue({
    from: mocks.from,
    auth: { admin: { getUserById: mocks.getUserById } },
    rpc: mocks.adminRpc,
  });
  mocks.adminRpc.mockImplementation((name: string) => {
    if (name === "login_rate_limit_hit") {
      return Promise.resolve({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    }
    if (name === "record_login") return Promise.resolve({ data: null, error: null });
    throw new Error(`Unexpected admin RPC: ${name}`);
  });
  mocks.createClient.mockResolvedValue({
    auth: { signInWithPassword: mocks.signInWithPassword },
  });
  mocks.profileEq.mockResolvedValue({
    data: [
      { user_id: "admin-1", is_active: true },
      { user_id: "inactive-1", is_active: false },
    ],
    error: null,
  });
  mocks.membershipRoleEq.mockResolvedValue({
    data: [{ user_id: "admin-1" }],
    error: null,
  });
  mocks.getUserById.mockResolvedValue({
    data: { user: { id: "admin-1", email: "admin@example.com" } },
    error: null,
  });
  mocks.signInWithPassword.mockResolvedValue({
    data: { session: { access_token: "token" } },
    error: null,
  });
});

describe("POST /api/platform/login", () => {
  it.each([
    { username: "", password: "secret" },
    { username: "hq", password: "" },
  ])("입력값이 빠지면 422를 반환한다", async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(422);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("정규화한 아이디를 활성 platform_admin 계정으로 해석하고 세션을 생성한다", async () => {
    const response = await POST(request(
      { username: "  HQ.Admin  ", password: "secret" },
      { "x-real-ip": "198.51.100.20" },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "admin-1" });
    expect(mocks.profileSelect).toHaveBeenCalledWith("user_id, is_active");
    expect(mocks.profileEq).toHaveBeenCalledWith("username", "hq.admin");
    expect(mocks.membershipIn).toHaveBeenCalledWith("user_id", ["admin-1"]);
    expect(mocks.membershipRoleEq).toHaveBeenCalledWith("role", "platform_admin");
    expect(mocks.getUserById).toHaveBeenCalledWith("admin-1");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "secret",
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith("record_login", {
      p_actor_id: "admin-1",
      p_ip: "198.51.100.20",
    });
  });

  it("platform_admin 소속이 아니면 계정 존재 여부를 숨긴 동일한 401을 반환한다", async () => {
    mocks.membershipRoleEq.mockResolvedValue({ data: [], error: null });

    const response = await POST(request({ username: "staff", password: "secret" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "아이디 또는 비밀번호가 올바르지 않습니다.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("존재하지 않는 계정도 동일한 401을 반환한다", async () => {
    mocks.profileEq.mockResolvedValue({ data: [], error: null });

    const response = await POST(request({ username: "missing", password: "secret" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "아이디 또는 비밀번호가 올바르지 않습니다.",
    });
    expect(mocks.membershipSelect).not.toHaveBeenCalled();
  });

  it("비밀번호가 틀리면 동일한 401을 반환한다", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(request({ username: "hq", password: "wrong" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "아이디 또는 비밀번호가 올바르지 않습니다.",
    });
  });
});
