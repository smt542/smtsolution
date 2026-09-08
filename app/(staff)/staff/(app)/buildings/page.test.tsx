import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./components/BuildingTenantManager", () => ({
  BuildingTenantManager: ({ initialData }: { initialData: { rows: Array<{ name: string }>; total: number } }) => (
    <div>LIST:{initialData.rows[0]?.name}:{initialData.total}</div>
  ),
}));

import BuildingsPage from "./page";

const contextRow = {
  org_id: 9,
  role: "staff",
  org_status: "active",
  username: "worker",
  full_name: "테스트 직원",
  is_active: true,
  must_change_password: false,
  staff_type: "manager_staff",
  permissions: ["buildings"],
};

const buildingRow = {
  id: 7,
  code: "B0007",
  name: "가나빌",
  address: "서울",
  manager_user_id: "manager-1",
  meter_user_id: null,
  cleaning_user_id: null,
  manager_name: "관리자",
  meter_name: null,
  cleaning_name: null,
  total_units: "12",
  occupied_units: "10",
  min_meter_day: 25,
  total: "31",
};

function mockServer({
  user = { id: "user-1" },
  context = contextRow,
}: {
  user?: { id: string } | null;
  context?: typeof contextRow;
} = {}) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "get_my_context") return { data: context, error: null };
    if (name === "list_buildings") return { data: [buildingRow], error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
  });
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

describe("BuildingsPage 게이트", () => {
  it("미인증이면 직원 로그인으로 보낸다", async () => {
    mockServer({ user: null });

    await expect(BuildingsPage()).rejects.toThrow("REDIRECT:/staff/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/staff/login");
  });

  it("buildings 권한 없으면 차단하고 목록을 조회하지 않는다", async () => {
    const rpc = mockServer({ context: { ...contextRow, permissions: [] } });

    render(await BuildingsPage());

    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("LIST")).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_my_context");
  });

  it("buildings 권한 있으면 변환한 서버 목록을 initialData로 전달한다", async () => {
    const rpc = mockServer();

    render(await BuildingsPage());

    expect(screen.getByText("LIST:가나빌:31")).toBeInTheDocument();
    expect(rpc).toHaveBeenNthCalledWith(1, "get_my_context");
    expect(rpc).toHaveBeenNthCalledWith(2, "list_buildings", {
      p_search: null,
      p_manager: null,
      p_meter: null,
      p_cleaning: null,
      p_limit: 20,
      p_offset: 0,
    });
  });
});
