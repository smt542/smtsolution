import { describe, it, expect, vi, beforeEach } from "vitest";

const { createClient, createAdminClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { POST } from "./route";

function serverClient({ user, ctx }: { user: unknown; ctx: unknown }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn().mockImplementation((name: string) =>
      name === "get_my_context"
        ? Promise.resolve({ data: ctx ? [ctx] : [], error: null })
        : Promise.resolve({ error: null })),
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { slug: "demo" }, error: null }) }) }),
    })),
  };
}
function req(body: unknown) {
  return new Request("http://localhost/api/accounts", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
const validBody = {
  username: "kim", password: "pw12", fullName: "김직원",
  role: "staff", staffType: "manager_staff", permissions: [], roleIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN = "staff.gwanribiseo.app";
});

describe("POST /api/accounts", () => {
  it("미인증 → 401", async () => {
    createClient.mockResolvedValue(serverClient({ user: null, ctx: null }));
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
  });

  it("accounts 권한 없는 직원 → 403", async () => {
    createClient.mockResolvedValue(serverClient({
      user: { id: "u1" }, ctx: { org_id: 1, role: "staff", permissions: [] },
    }));
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("마스터 정상 → 201 + provision_member 호출", async () => {
    const rpc = vi.fn().mockImplementation((name: string) =>
      name === "get_my_context"
        ? Promise.resolve({ data: [{ org_id: 1, role: "org_owner", permissions: [] }], error: null })
        : Promise.resolve({ error: null }));
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
      rpc,
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { slug: "demo" }, error: null }) }) }),
      })),
    });
    const createUser = vi.fn().mockResolvedValue({ data: { user: { id: "new-uid" } }, error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { createUser, deleteUser: vi.fn() } } });

    const res = await POST(req(validBody));
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "demo.kim@staff.gwanribiseo.app", password: "pw12", email_confirm: true,
    }));
    expect(rpc).toHaveBeenCalledWith("provision_member", expect.objectContaining({
      p_user_id: "new-uid", p_username: "kim", p_staff_type: "manager_staff",
    }));
  });
});
