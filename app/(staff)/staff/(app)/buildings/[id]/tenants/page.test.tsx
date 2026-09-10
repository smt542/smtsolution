import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getStaffContext: vi.fn(),
}));

vi.mock("../../../_staffContext", () => ({ getStaffContext: mocks.getStaffContext }));
vi.mock("../components/TenantList", () => ({ TenantList: ({ buildingId }: { buildingId: number }) => <div>TENANTS {buildingId}</div> }));

import TenantsPage from "./page";

beforeEach(() => vi.clearAllMocks());
describe("TenantsPage 게이트", () => {
  it("tenants 권한 없으면 차단", async () => {
    mocks.getStaffContext.mockResolvedValue({ role: "field", permissions: [] });

    render(await TenantsPage({ params: Promise.resolve({ id: "7" }) }));

    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });

  it("tenants 권한 있으면 숫자 buildingId를 목록에 전달", async () => {
    mocks.getStaffContext.mockResolvedValue({ role: "staff", permissions: ["tenants"] });

    render(await TenantsPage({ params: Promise.resolve({ id: "7" }) }));

    expect(screen.getByText("TENANTS 7")).toBeInTheDocument();
  });
});
