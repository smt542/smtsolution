import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/reactquery/occupancies", () => ({ useTenantList: vi.fn() }));
import { useTenantList } from "@/hooks/reactquery/occupancies";
import { TenantList } from "./TenantList";
beforeEach(() => vi.clearAllMocks());

describe("TenantList", () => {
  it("행 더블클릭 시 상세로 이동", () => {
    vi.mocked(useTenantList).mockReturnValue({ data: [{ unitId:3, occupancyId:9, unitNo:"101", tenantName:"김입주", roomTypeLabel:"원룸", residentCount:2, moveInDate:"2026-01-01", isVacant:false, isOverdue:false }], isLoading:false, isError:false } as unknown as ReturnType<typeof useTenantList>);
    render(<TenantList buildingId={7} />);
    fireEvent.doubleClick(screen.getByText("101"));
    expect(push).toHaveBeenCalledWith("/staff/buildings/7/tenants/3");
  });
  it("공실 세대는 입주자명 대신 공실 표시", () => {
    vi.mocked(useTenantList).mockReturnValue({ data: [{ unitId:4, occupancyId:null, unitNo:"102", tenantName:null, roomTypeLabel:null, residentCount:null, moveInDate:null, isVacant:true, isOverdue:false }], isLoading:false, isError:false } as unknown as ReturnType<typeof useTenantList>);
    render(<TenantList buildingId={7} />);
    expect(screen.getAllByText("공실").length).toBeGreaterThan(0);
  });
  it("등록 버튼 → tenants/new", () => {
    vi.mocked(useTenantList).mockReturnValue({ data: [], isLoading:false, isError:false } as unknown as ReturnType<typeof useTenantList>);
    render(<TenantList buildingId={7} />);
    fireEvent.click(screen.getByRole("button", { name: /입주자 등록/ }));
    expect(push).toHaveBeenCalledWith("/staff/buildings/7/tenants/new");
  });
});
