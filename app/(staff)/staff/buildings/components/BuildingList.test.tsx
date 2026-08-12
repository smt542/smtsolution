import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildingList: vi.fn(),
  useStaffOptions: vi.fn(() => ({ data: [] })),
}));
import { useBuildingList } from "@/hooks/reactquery/buildings";
import { BuildingList } from "./BuildingList";

beforeEach(() => vi.clearAllMocks());

describe("BuildingList", () => {
  it("행 더블클릭 시 상세로 이동", () => {
    vi.mocked(useBuildingList).mockReturnValue({
      data: { rows: [{ id: 5, code: "B0005", name: "가나빌", address: "서울", managerUserId: null, meterUserId: null,
        cleaningUserId: null, managerName: "김관리", meterName: null, cleaningName: null, totalUnits: 3, occupiedUnits: 2, minMeterDay: 5 }], total: 1 },
      isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useBuildingList>);
    render(<BuildingList />);
    fireEvent.doubleClick(screen.getByText("가나빌"));
    expect(push).toHaveBeenCalledWith("/staff/buildings/5");
  });

  it("결과 없음 안내", () => {
    vi.mocked(useBuildingList).mockReturnValue({ data: { rows: [], total: 0 }, isLoading: false, isError: false } as unknown as ReturnType<typeof useBuildingList>);
    render(<BuildingList />);
    expect(screen.getByText(/조건에 맞는 건물이 없습니다|등록된 건물이 없습니다/)).toBeInTheDocument();
  });

  it("등록 버튼 → /new 이동", () => {
    vi.mocked(useBuildingList).mockReturnValue({ data: { rows: [], total: 0 }, isLoading: false, isError: false } as unknown as ReturnType<typeof useBuildingList>);
    render(<BuildingList />);
    fireEvent.click(screen.getByRole("button", { name: /건물 등록/ }));
    expect(push).toHaveBeenCalledWith("/staff/buildings/new");
  });
});
