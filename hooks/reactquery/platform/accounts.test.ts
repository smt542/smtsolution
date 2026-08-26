import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc }),
}));

import { platformSetActive, platformUpdateAccount, platformUpdateRole } from "./accounts";

beforeEach(() => vi.clearAllMocks());

describe("platform account apis", () => {
  it("platformUpdateRole은 target org를 포함해 admin_set_member_permissions를 호출한다", async () => {
    rpc.mockResolvedValue({ error: null });

    await platformUpdateRole(7, "u1", "manager", "manager_staff", []);

    expect(rpc).toHaveBeenCalledWith("admin_set_member_permissions", {
      p_user_id: "u1",
      p_role: "manager",
      p_staff_type: "manager_staff",
      p_permissions: [],
      p_role_ids: null,
      p_target_org_id: 7,
    });
  });

  it("platformSetActive는 target org를 포함해 admin_set_active를 호출한다", async () => {
    rpc.mockResolvedValue({ error: null });

    await platformSetActive(7, "u1", false);

    expect(rpc).toHaveBeenCalledWith("admin_set_active", {
      p_user_id: "u1",
      p_active: false,
      p_target_org_id: 7,
    });
  });

  it("platformUpdateAccount는 이름·전화·메모를 전용 RPC로 저장한다", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await platformUpdateAccount({
      orgId: 7,
      userId: "u1",
      fullName: "김관리",
      phone: " 010-1234-5678 ",
      memo: " 운영 총괄 ",
    });

    expect(rpc).toHaveBeenCalledWith("platform_update_account", {
      p_org_id: 7,
      p_user_id: "u1",
      p_full_name: "김관리",
      p_phone: "010-1234-5678",
      p_memo: "운영 총괄",
    });
  });
});
