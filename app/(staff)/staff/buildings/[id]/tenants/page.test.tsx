import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "7" }) }));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("../components/TenantList", () => ({ TenantList: ({ buildingId }: { buildingId: number }) => <div>TENANTS {buildingId}</div> }));
import TenantsPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
beforeEach(() => vi.clearAllMocks());
describe("TenantsPage 게이트", () => {
  it("tenants 권한 없으면 차단", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "field_staff", permissions: [] } } as any);
    render(<TenantsPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });
  it("tenants 권한 있으면 목록(buildingId 전달)", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: ["tenants"] } } as any);
    render(<TenantsPage />);
    expect(screen.getByText("TENANTS 7")).toBeInTheDocument();
  });
});
