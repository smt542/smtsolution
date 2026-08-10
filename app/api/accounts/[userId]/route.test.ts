import { describe, it, expect, vi, beforeEach } from "vitest";

const { createClient, createAdminClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { PATCH } from "./route";

function ctxRpc(ctx: any, accounts: any[]) {
  return vi.fn().mockImplementation((name: string) =>
    name === "get_my_context"
      ? Promise.resolve({ data: ctx ? [ctx] : [], error: null })
      : name === "list_accounts"
      ? Promise.resolve({ data: accounts, error: null })
      : Promise.resolve({ error: null }));
}
const params = Promise.resolve({ userId: "target-uid" });
function req(body: any) {
  return new Request("http://localhost/api/accounts/target-uid", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/accounts/:userId", () => {
  it("미인증 → 401", async () => {
    createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, rpc: vi.fn() });
    const res = await PATCH(req({ password: "new" }), { params });
    expect(res.status).toBe(401);
  });

  it("권한 없음 → 403", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      rpc: ctxRpc({ org_id: 1, role: "staff", permissions: [] }, []),
    });
    const res = await PATCH(req({ password: "new" }), { params });
    expect(res.status).toBe(403);
  });

  it("마스터 정상 → 200 + updateUserById 호출", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      rpc: ctxRpc({ org_id: 1, role: "org_owner", permissions: [] }, [{ user_id: "target-uid" }]),
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    const res = await PATCH(req({ password: "newpw" }), { params });
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("target-uid", { password: "newpw" });
  });

  it("대상 계정 없음(다른 org) → 404 + updateUserById 미호출", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      rpc: ctxRpc({ org_id: 1, role: "org_owner", permissions: [] }, []),
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    const res = await PATCH(req({ password: "newpw" }), { params });
    expect(res.status).toBe(404);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("비밀번호 누락 → 422 + updateUserById 미호출", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      rpc: ctxRpc({ org_id: 1, role: "org_owner", permissions: [] }, [{ user_id: "target-uid" }]),
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    const res = await PATCH(req({}), { params });
    expect(res.status).toBe(422);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("비밀번호 너무 짧음(3자 미만) → 422 + updateUserById 미호출", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      rpc: ctxRpc({ org_id: 1, role: "org_owner", permissions: [] }, [{ user_id: "target-uid" }]),
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    const res = await PATCH(req({ password: "1" }), { params });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/4자 이상/);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
