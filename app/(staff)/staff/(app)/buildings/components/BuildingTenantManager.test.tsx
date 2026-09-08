import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuildingTenantManager } from "./BuildingTenantManager";

const mocks = vi.hoisted(() => ({
  useBuildingList: vi.fn(),
  useTenantList: vi.fn(),
}));

vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildingList: mocks.useBuildingList,
  useStaffOptions: () => ({ data: [] }),
}));

vi.mock("@/hooks/reactquery/buildingCustomerNumbers", () => ({
  useBuildingMeterDays: () => ({ data: {} }),
}));

vi.mock("@/hooks/reactquery/occupancies", () => ({
  useTenantList: mocks.useTenantList,
}));

vi.mock("./BuildingSearchCard", () => ({
  BuildingSearchCard: () => null,
  initialBuildingFilter: {
    regSort: "desc",
    managerUserId: null,
    meterUserId: null,
    cleaningUserId: null,
    meterKind: "",
    meterDir: "asc",
  },
  isFilterActive: () => false,
}));

vi.mock("./BuildingDirectoryCard", () => ({
  BuildingDirectoryCard: ({ onSelect }: { onSelect: (building: { id: number; name: string }) => void }) => (
    <button type="button" onClick={() => onSelect({ id: 7, name: "그린빌라" })}>건물 선택</button>
  ),
}));

vi.mock("./TenantOccupancyCard", () => ({
  TenantOccupancyCard: ({ onOpenManagementCard }: { onOpenManagementCard: (tenant: { unitId: number }) => void }) => (
    <button type="button" onClick={() => onOpenManagementCard({ unitId: 101 })}>입주민 행</button>
  ),
}));

vi.mock("./TenantManagementCardModal", () => ({
  TenantManagementCardModal: ({ buildingId, unitId }: { buildingId: number; unitId: number }) => (
    <div>{`관리카드:${buildingId}:${unitId}`}</div>
  ),
}));

vi.mock("./TenantOutputModal", () => ({
  TenantOutputModal: () => <div>출력 모달</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useBuildingList.mockReturnValue({
    data: { rows: [{ id: 7, name: "그린빌라" }], total: 1 },
    isLoading: false,
    isError: false,
  });
  mocks.useTenantList.mockReturnValue({ data: [], isLoading: false, isError: false });
});

describe("BuildingTenantManager", () => {
  it("입주민 행 클릭은 출력 모달이 아니라 입주민 관리카드 모달을 연다", () => {
    render(<BuildingTenantManager initialData={{ rows: [], total: 0 }} />);

    fireEvent.click(screen.getByRole("button", { name: "건물 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "입주민 행" }));

    expect(screen.getByText("관리카드:7:101")).toBeInTheDocument();
    expect(screen.queryByText("출력 모달")).not.toBeInTheDocument();
  });

  it("상단 출력 버튼은 출력 모달만 연다", () => {
    render(<BuildingTenantManager initialData={{ rows: [], total: 0 }} />);

    fireEvent.click(screen.getByRole("button", { name: "입주자카드 및 부과내역 출력" }));

    expect(screen.getByText("출력 모달")).toBeInTheDocument();
    expect(screen.queryByText(/관리카드:/)).not.toBeInTheDocument();
  });
});
