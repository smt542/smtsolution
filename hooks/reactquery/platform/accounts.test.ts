import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc }),
}));

import { platformSetActive, platformUpdateRole } from "./accounts";

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
});
