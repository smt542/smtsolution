import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
  profileSelect: vi.fn(),
  profileEq: vi.fn(),
  membershipSelect: vi.fn(),
  membershipIn: vi.fn(),
  membershipStaffTypeEq: vi.fn(),
  getUserById: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "./route";

const INVALID_RESPONSE = { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
const CONTEXT_ROW = {
  org_id: 7,
  role: "staff",
  org_status: "active",
  username: "office.user",
  full_name: "관리 직원",
  is_active: true,
  must_change_password: true,
  staff_type: "manager_staff",
  permissions: ["buildings", "accounts"],
};
const CONTEXT = {
  orgId: 7,
  role: "staff",
  orgStatus: "active",
  username: "office.user",
  fullName: "관리 직원",
  isActive: true,
  mustChangePassword: true,
  staffType: "manager_staff",
  permissions: ["buildings", "accounts"],
};

function request(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/staff/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.from.mockImplementation((table: string) => {
    if (table === "profiles") return { select: mocks.profileSelect };
    if (table === "org_members") return { select: mocks.membershipSelect };
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.profileSelect.mockReturnValue({ eq: mocks.profileEq });
  mocks.membershipSelect.mockReturnValue({ in: mocks.membershipIn });
  mocks.membershipIn.mockReturnValue({ eq: mocks.membershipStaffTypeEq });
  mocks.createAdminClient.mockReturnValue({
    from: mocks.from,
    auth: { admin: { getUserById: mocks.getUserById } },
    rpc: mocks.adminRpc,
  });
  mocks.adminRpc.mockImplementation((name: string) => {
    if (name === "login_rate_limit_hit") {
      return Promise.resolve({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    }
    throw new Error(`Unexpected admin RPC: ${name}`);
  });
  mocks.createClient.mockResolvedValue({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
    rpc: mocks.rpc,
  });
  mocks.profileEq.mockResolvedValue({ data: [{ user_id: "office-1" }], error: null });
  mocks.membershipStaffTypeEq.mockResolvedValue({ data: [{ user_id: "office-1" }], error: null });
  mocks.getUserById.mockResolvedValue({
    data: { user: { id: "office-1", email: "office@example.com" } },
    error: null,
  });
  mocks.signInWithPassword.mockResolvedValue({
    data: { session: { access_token: "token" } },
    error: null,
  });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "get_my_context") return Promise.resolve({ data: [CONTEXT_ROW], error: null });
    if (name === "record_login") return Promise.resolve({ data: null, error: null });
    throw new Error(`Unexpected RPC: ${name}`);
  });
});

describe("POST /api/staff/login", () => {
  it.each([
    { username: "", password: "secret" },
    { username: "office", password: "" },
    { password: "secret" },
  ])("입력값이 빠지면 422를 반환한다", async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(422);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("정규화한 아이디로 manager_staff를 찾아 세션과 컨텍스트를 반환하고 로그인을 기록한다", async () => {
    const response = await POST(request(
      { username: "  Office.User  ", password: "secret" },
      { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(CONTEXT);
    expect(mocks.profileSelect).toHaveBeenCalledWith("user_id");
    expect(mocks.profileEq).toHaveBeenCalledWith("username", "office.user");
    expect(mocks.membershipIn).toHaveBeenCalledWith("user_id", ["office-1"]);
    expect(mocks.membershipStaffTypeEq).toHaveBeenCalledWith("staff_type", "manager_staff");
    expect(mocks.getUserById).toHaveBeenCalledWith("office-1");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "office@example.com",
      password: "secret",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_my_context");
    expect(mocks.rpc).toHaveBeenCalledWith("record_login", { p_ip: "203.0.113.10" });
  });

  it("동일 아이디 후보 중 비밀번호가 맞는 계정을 선택한다", async () => {
    mocks.profileEq.mockResolvedValue({
      data: [{ user_id: "office-1" }, { user_id: "office-2" }],
      error: null,
    });
    mocks.membershipStaffTypeEq.mockResolvedValue({
      data: [{ user_id: "office-1" }, { user_id: "office-2" }],
      error: null,
    });
    mocks.getUserById.mockImplementation((userId: string) => Promise.resolve({
      data: { user: { id: userId, email: `${userId}@example.com` } },
      error: null,
    }));
    mocks.signInWithPassword
      .mockResolvedValueOnce({ data: { session: null }, error: { message: "Invalid" } })
      .mockResolvedValueOnce({ data: { session: { access_token: "token" } }, error: null });

    const response = await POST(request({ username: "office.user", password: "secret" }));

    expect(response.status).toBe(200);
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(2);
    expect(mocks.signInWithPassword).toHaveBeenLastCalledWith({
      email: "office-2@example.com",
      password: "secret",
    });
  });

  it("비밀번호가 틀리면 계정 존재 여부를 숨긴 401을 반환한다", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(request({ username: "office.user", password: "wrong" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(INVALID_RESPONSE);
  });

  it("존재하지 않는 계정에도 동일한 401을 반환하고 세션 클라이언트를 만들지 않는다", async () => {
    mocks.profileEq.mockResolvedValue({ data: [], error: null });

    const response = await POST(request({ username: "missing", password: "secret" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(INVALID_RESPONSE);
    expect(mocks.membershipSelect).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("내근 계정이 아닌 후보에도 동일한 401을 반환하고 세션 클라이언트를 만들지 않는다", async () => {
    mocks.membershipStaffTypeEq.mockResolvedValue({ data: [], error: null });

    const response = await POST(request({ username: "field.user", password: "secret" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(INVALID_RESPONSE);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it.each([
    { row: null, message: "접근 권한이 없는 계정입니다." },
    {
      row: { ...CONTEXT_ROW, is_active: false },
      message: "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
    },
    {
      row: { ...CONTEXT_ROW, org_status: "suspended" },
      message: "정지되었거나 사용할 수 없는 조직입니다.",
    },
  ])("비밀번호 인증 후 접근 조건을 거부하면 세션을 종료한다", async ({ row, message }) => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "get_my_context") {
        return Promise.resolve({ data: row ? [row] : [], error: null });
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const response = await POST(request({ username: "office.user", password: "secret" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: message });
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith("record_login", expect.anything());
  });
});
