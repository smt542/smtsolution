import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildingList: vi.fn(),
  useStaffOptions: vi.fn(() => ({ data: [] })),
}));
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useTenantList: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
}));
vi.mock("@/hooks/reactquery/billing", () => ({
  useBilling: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
}));
import { useBuildingList } from "@/hooks/reactquery/buildings";
import { useBilling } from "@/hooks/reactquery/billing";
import { useTenantList } from "@/hooks/reactquery/occupancies";
import { BuildingList } from "./BuildingList";

const initialData = { rows: [], total: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTenantList).mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTenantList>);
  vi.mocked(useBilling).mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useBilling>);
});

describe("BuildingList", () => {
  it("행 더블클릭 시 상세로 이동", () => {
    vi.mocked(useBuildingList).mockReturnValue({
      data: { rows: [{ id: 5, code: "B0005", name: "가나빌", address: "서울", managerUserId: null, meterUserId: null,
        cleaningUserId: null, managerName: "김관리", meterName: null, cleaningName: null, totalUnits: 3, occupiedUnits: 2, minMeterDay: 5 }], total: 1 },
      isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useBuildingList>);
    render(<BuildingList initialData={initialData} />);
    expect(useBuildingList).toHaveBeenCalledWith({
      search: undefined,
      managerUserId: undefined,
      meterUserId: undefined,
      cleaningUserId: undefined,
      page: 1,
      pageSize: 20,
    }, initialData);
    fireEvent.doubleClick(screen.getByText("가나빌"));
    expect(push).toHaveBeenCalledWith("/staff/buildings/5");
  });

  it("결과 없음 안내", () => {
    vi.mocked(useBuildingList).mockReturnValue({ data: { rows: [], total: 0 }, isLoading: false, isError: false } as unknown as ReturnType<typeof useBuildingList>);
    render(<BuildingList initialData={initialData} />);
    expect(screen.getByText(/조건에 맞는 건물이 없습니다|등록된 건물이 없습니다/)).toBeInTheDocument();
  });

  it("등록 버튼 → /new 이동", () => {
    vi.mocked(useBuildingList).mockReturnValue({ data: { rows: [], total: 0 }, isLoading: false, isError: false } as unknown as ReturnType<typeof useBuildingList>);
    render(<BuildingList initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: /건물 등록/ }));
    expect(push).toHaveBeenCalledWith("/staff/buildings/new");
  });

  it("출력 모달은 건물 미선택·선택 디자인 상태를 모두 제공", () => {
    vi.mocked(useTenantList).mockReturnValue({
      data: [{ unitId: 11, unitNo: "201", dong: null, roomTypeLabel: "원룸", occupancyId: 21,
        tenantName: "홍길동", phone: "010-1234-5678", secondaryPhone: null, moveInDate: "2026-01-15",
        residentCount: 1, status: "occupied", isVacant: false, isOverdue: false }],
      isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useTenantList>);
    vi.mocked(useBilling).mockReturnValue({
      data: [{ unitId: 11, totalAmount: 120000 }], isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useBilling>);
    vi.mocked(useBuildingList).mockReturnValue({
      data: { rows: [{ id: 5, code: "B0005", name: "가나빌", address: "서울", managerUserId: null, meterUserId: null,
        cleaningUserId: null, managerName: "김관리", meterName: null, cleaningName: null, totalUnits: 3, occupiedUnits: 2, minMeterDay: 5 }], total: 1 },
      isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useBuildingList>);
    render(<BuildingList initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: "입주자카드 및 부과내역 출력" }));
    expect(screen.getByRole("dialog", { name: "입주자카드 및 부과내역 출력" })).toBeInTheDocument();
    expect(screen.getByText("출력할 건물을 선택해 주세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "출력하기" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /005.*가나빌/ }));
    expect(screen.getByTestId("building-output-previews")).toBeInTheDocument();
    expect(screen.getByText("입주자 카드")).toBeInTheDocument();
    expect(screen.getByText("관리비 부과내역서")).toBeInTheDocument();
    expect(screen.getByText("120,000원")).toBeInTheDocument();
    expect(useBilling).toHaveBeenLastCalledWith(5, "2026-08-01");
    expect(screen.getByRole("button", { name: "출력하기" })).toBeEnabled();
  });
});
