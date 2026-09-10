import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getStaffContext } from "./_staffContext";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("getStaffContext", () => {
  it("get_my_context 결과를 MyContext로 변환한다", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        org_id: 9,
        role: "staff",
        org_status: "active",
        username: "worker",
        full_name: "테스트 직원",
        is_active: true,
        must_change_password: false,
        staff_type: "manager_staff",
        staff_capabilities: ["manager_staff", "support_staff"],
        permissions: ["buildings", "tenants"],
      },
      error: null,
    });

    await expect(getStaffContext()).resolves.toEqual({
      orgId: 9,
      role: "staff",
      orgStatus: "active",
      username: "worker",
      fullName: "테스트 직원",
      isActive: true,
      mustChangePassword: false,
      staffType: "manager_staff",
      staffCapabilities: ["manager_staff", "support_staff"],
      permissions: ["buildings", "tenants"],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_my_context");
  });

  it("컨텍스트가 없으면 null을 반환하고 RPC 오류는 전달한다", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "failed" } });

    await expect(getStaffContext()).resolves.toBeNull();
    await expect(getStaffContext()).rejects.toThrow("failed");
  });
});
