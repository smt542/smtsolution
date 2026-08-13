import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/reactquery/platform", () => ({ useBuildingTenants: vi.fn() }));
import { BuildingTenantsList } from "./BuildingTenantsList";
import { useBuildingTenants } from "@/hooks/reactquery/platform";
beforeEach(() => vi.clearAllMocks());

const DATA = {
  org: { id: 3, name: "가나관리" },
  building: { id: 7, name: "가나빌" },
  tenants: [{ unitId: 11, occupancyId: 22, unitNo: "101", tenantName: "홍길동", residentCount: 2, moveInDate: "2026-01-01", isVacant: false }],
};

describe("BuildingTenantsList", () => {
  it("세대 없음", () => {
    vi.mocked(useBuildingTenants).mockReturnValue({ isPending: false, isError: false, data: { ...DATA, tenants: [] } } as never);
    render(<BuildingTenantsList orgId={3} buildingId={7} />);
    expect(screen.getByText("등록된 세대가 없습니다")).toBeInTheDocument();
  });
  it("목록 + 행 클릭 시 세대 상세로", () => {
    vi.mocked(useBuildingTenants).mockReturnValue({ isPending: false, isError: false, data: DATA } as never);
    render(<BuildingTenantsList orgId={3} buildingId={7} />);
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    fireEvent.click(screen.getByText("홍길동"));
    expect(push).toHaveBeenCalledWith("/platform-admin/organizations/3/buildings/7/units/11");
  });
});
