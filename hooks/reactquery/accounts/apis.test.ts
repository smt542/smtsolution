import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
import { listAccounts, updatePermissions, setActive, createAccount } from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("accounts apis", () => {
  it("listAccounts: snake→camel 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      user_id: "u1", username: "kim", full_name: "김직원", phone: "010", phone_sub: null,
      role: "staff", staff_type: "manager_staff", affiliation: null, is_active: true,
      permissions: ["buildings"], role_labels: ["관리"],
    }], error: null });
    const r = await listAccounts({ search: "김" });
    expect(rpc).toHaveBeenCalledWith("list_accounts", { p_search: "김", p_type: null });
    expect(r[0]).toMatchObject({ userId: "u1", fullName: "김직원", staffType: "manager_staff", roleLabels: ["관리"] });
  });

  it("updatePermissions: admin_set_member_permissions 인자 매핑", async () => {
    rpc.mockResolvedValue({ error: null });
    await updatePermissions("u1", { role: "org_owner", staffType: "manager_staff", permissions: ["accounts"], roleIds: [2] });
    expect(rpc).toHaveBeenCalledWith("admin_set_member_permissions", {
      p_user_id: "u1", p_role: "org_owner", p_staff_type: "manager_staff",
      p_permissions: ["accounts"], p_role_ids: [2],
    });
  });

  it("setActive: admin_set_active 호출", async () => {
    rpc.mockResolvedValue({ error: null });
    await setActive("u1", false);
    expect(rpc).toHaveBeenCalledWith("admin_set_active", { p_user_id: "u1", p_active: false });
  });

  it("createAccount: POST /api/accounts 실패 시 에러 메시지 throw", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "이미 존재하는 아이디입니다." }) }) as unknown as typeof fetch;
    await expect(createAccount({
      username: "kim", password: "pw", fullName: "김", role: "staff",
      staffType: "manager_staff", permissions: [], roleIds: [],
    })).rejects.toThrow("이미 존재하는 아이디입니다.");
  });
});
