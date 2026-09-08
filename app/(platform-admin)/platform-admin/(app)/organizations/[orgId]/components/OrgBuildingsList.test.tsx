import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/reactquery/platform", () => ({ useOrgBuildings: vi.fn() }));
import { OrgBuildingsList } from "./OrgBuildingsList";
import { useOrgBuildings } from "@/hooks/reactquery/platform";
beforeEach(() => vi.clearAllMocks());

describe("OrgBuildingsList", () => {
  it("로딩 상태", () => {
    vi.mocked(useOrgBuildings).mockReturnValue({ isPending: true, data: undefined } as never);
    render(<OrgBuildingsList orgId={3} />);
    expect(screen.getByLabelText("불러오는 중")).toBeInTheDocument();
  });
  it("건물 없음", () => {
    vi.mocked(useOrgBuildings).mockReturnValue({ isPending: false, isError: false, data: { org: { id: 3, name: "가나관리", slug: "gana", status: "active" }, buildings: [] } } as never);
    render(<OrgBuildingsList orgId={3} />);
    expect(screen.getByText("등록된 건물이 없습니다")).toBeInTheDocument();
  });
  it("목록 + 행 클릭 시 건물 상세로", () => {
    vi.mocked(useOrgBuildings).mockReturnValue({ isPending: false, isError: false, data: { org: { id: 3, name: "가나관리", slug: "gana", status: "active" }, buildings: [{ id: 7, code: "B0007", name: "가나빌", address: "서울" }] } } as never);
    render(<OrgBuildingsList orgId={3} />);
    expect(screen.getByText("가나빌")).toBeInTheDocument();
    fireEvent.click(screen.getByText("가나빌"));
    expect(push).toHaveBeenCalledWith("/platform-admin/organizations/3/buildings/7");
  });
});
