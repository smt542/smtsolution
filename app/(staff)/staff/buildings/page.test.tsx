import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation before any imports
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock all react-query hooks
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildings: vi.fn(),
  useCreateBuilding: vi.fn(),
  useUpdateBuilding: vi.fn(),
  useDeleteBuilding: vi.fn(),
}));

vi.mock("@/hooks/reactquery/units", () => ({
  useUnits: vi.fn(),
  useCreateUnit: vi.fn(),
  useUpdateUnit: vi.fn(),
  useDeleteUnit: vi.fn(),
}));

vi.mock("@/hooks/reactquery/occupancies", () => ({
  useOccupancies: vi.fn(),
  useCreateOccupancy: vi.fn(),
  useUpdateOccupancy: vi.fn(),
  useDeleteOccupancy: vi.fn(),
}));

vi.mock("@/hooks/reactquery/buildingTypes", () => ({
  useBuildingTypes: vi.fn(),
}));

vi.mock("@/hooks/reactquery/auth", () => ({
  useMe: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import BuildingListPage from "./page";
import {
  useBuildings,
  useCreateBuilding,
  useUpdateBuilding,
  useDeleteBuilding,
} from "@/hooks/reactquery/buildings";
import {
  useUnits,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
} from "@/hooks/reactquery/units";
import {
  useOccupancies,
  useCreateOccupancy,
  useUpdateOccupancy,
  useDeleteOccupancy,
} from "@/hooks/reactquery/occupancies";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { useMe } from "@/hooks/reactquery/auth";

const mockBuildings = [
  {
    id: 1,
    orgId: 10,
    code: "BLD001",
    name: "그린빌라",
    address: "서울시 강남구",
    typeId: 1,
    ownerName: "홍길동",
    ownerPhone: "010-1234-5678",
    entrancePassword: null,
    managerName: null,
    meterStaffName: null,
    cleaningStaffName: null,
    memo: null,
  },
  {
    id: 2,
    orgId: 10,
    code: "BLD002",
    name: "블루타워",
    address: "서울시 서초구",
    typeId: null,
    ownerName: "김철수",
    ownerPhone: null,
    entrancePassword: null,
    managerName: null,
    meterStaffName: null,
    cleaningStaffName: null,
    memo: null,
  },
];

const mockUnits = [
  {
    id: 101,
    buildingId: 1,
    unitNo: "101호",
    dong: null,
    areaPyeong: null,
    roomCount: 2,
    elecCustomerNo: null,
    elecMeterNo: null,
    waterCustomerNo: null,
    memo: null,
  },
];

const mockOccupancies = [
  {
    id: 201,
    unitId: 101,
    tenantName: "김입주",
    phone: "010-9999-8888",
    status: "occupied",
    moveInDate: "2024-01-01",
    moveOutDate: null,
  },
];

const mockBuildingTypes = [{ id: 1, orgId: 10, label: "빌라", sortOrder: 1 }];

const mockMutate = { mutateAsync: vi.fn(), isPending: false };

function setupMocks() {
  vi.mocked(useBuildings).mockReturnValue({
    data: mockBuildings,
    isLoading: false,
    error: null,
  } as any);
  vi.mocked(useUnits).mockReturnValue({
    data: mockUnits,
    isLoading: false,
    error: null,
  } as any);
  vi.mocked(useOccupancies).mockReturnValue({
    data: mockOccupancies,
    isLoading: false,
    error: null,
  } as any);
  vi.mocked(useBuildingTypes).mockReturnValue({
    data: mockBuildingTypes,
    isLoading: false,
  } as any);
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 10 } } as any);
  vi.mocked(useCreateBuilding).mockReturnValue(mockMutate as any);
  vi.mocked(useUpdateBuilding).mockReturnValue(mockMutate as any);
  vi.mocked(useDeleteBuilding).mockReturnValue(mockMutate as any);
  vi.mocked(useCreateUnit).mockReturnValue(mockMutate as any);
  vi.mocked(useUpdateUnit).mockReturnValue(mockMutate as any);
  vi.mocked(useDeleteUnit).mockReturnValue(mockMutate as any);
  vi.mocked(useCreateOccupancy).mockReturnValue(mockMutate as any);
  vi.mocked(useUpdateOccupancy).mockReturnValue(mockMutate as any);
  vi.mocked(useDeleteOccupancy).mockReturnValue(mockMutate as any);
}

describe("BuildingListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("renders building list with sample building name 그린빌라", () => {
    render(<BuildingListPage />);
    expect(screen.getByText("그린빌라")).toBeInTheDocument();
  });

  it("renders 블루타워 in the list", () => {
    render(<BuildingListPage />);
    expect(screen.getByText("블루타워")).toBeInTheDocument();
  });

  it("renders + 건물 등록 button", () => {
    render(<BuildingListPage />);
    expect(
      screen.getByRole("button", { name: /건물 등록/ })
    ).toBeInTheDocument();
  });

  it("clicking a building row renders the detail panel with unit info", async () => {
    render(<BuildingListPage />);
    const row = screen.getByText("그린빌라");
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByText("101호")).toBeInTheDocument();
    });
  });

  it("clicking + 건물 등록 opens the modal", async () => {
    render(<BuildingListPage />);
    const btn = screen.getByRole("button", { name: /건물 등록/ });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText("건물 등록")).toBeInTheDocument();
    });
  });

  it("clicking a unit row renders OccupancyList and does NOT open unit edit modal", async () => {
    render(<BuildingListPage />);
    // First select a building to reveal the unit list
    fireEvent.click(screen.getByText("그린빌라"));
    await waitFor(() => expect(screen.getByText("101호")).toBeInTheDocument());

    // Click the unit row — should show the occupancy tenant name
    fireEvent.click(screen.getByText("101호"));
    await waitFor(() => {
      expect(screen.getByText("김입주")).toBeInTheDocument();
    });

    // The unit edit modal must NOT be open (modal title "호실 수정" must not appear)
    expect(screen.queryByText("호실 수정")).toBeNull();
  });

  it("clicking unit 수정 button opens the unit edit modal", async () => {
    render(<BuildingListPage />);
    fireEvent.click(screen.getByText("그린빌라"));
    await waitFor(() => expect(screen.getByText("101호")).toBeInTheDocument());

    const editBtn = screen.getByRole("button", { name: /101호 수정/ });
    fireEvent.click(editBtn);
    // UnitFormModal title is "호실 수정" when editing
    await waitFor(() => {
      expect(screen.getByText("호실 수정")).toBeInTheDocument();
    });
  });

  // --- New tests: delete affordances ---

  it("clicking building 삭제 shows confirm dialog with cascade warning", async () => {
    render(<BuildingListPage />);
    fireEvent.click(screen.getByText("그린빌라"));
    await waitFor(() => expect(screen.getByText("건물 상세")).toBeInTheDocument());

    // Use getAllByRole and pick the first 삭제 button (building detail panel)
    const deleteBtns = screen.getAllByRole("button", { name: /삭제/ });
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(
        screen.getByText(/이 건물의 호실·입주자도 함께 삭제됩니다/)
      ).toBeInTheDocument();
    });
  });

  it("confirming building delete calls useDeleteBuilding().mutateAsync", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteBuilding).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);

    render(<BuildingListPage />);
    fireEvent.click(screen.getByText("그린빌라"));
    await waitFor(() => expect(screen.getByText("건물 상세")).toBeInTheDocument());

    // Click the first 삭제 button (building detail panel)
    const deleteBtns = screen.getAllByRole("button", { name: /삭제/ });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() =>
      expect(screen.getByText(/이 건물의 호실·입주자도 함께 삭제됩니다/)).toBeInTheDocument()
    );

    // Click 확인 in the confirm modal
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(1);
    });
  });

  it("clicking unit 삭제 shows confirm dialog", async () => {
    render(<BuildingListPage />);
    fireEvent.click(screen.getByText("그린빌라"));
    await waitFor(() => expect(screen.getByText("101호")).toBeInTheDocument());

    const deleteBtn = screen.getByRole("button", { name: /101호 삭제/ });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/이 호실의 입주자 정보도 함께 삭제됩니다/)
      ).toBeInTheDocument();
    });
  });

  it("confirming unit delete calls useDeleteUnit().mutateAsync", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteUnit).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);

    render(<BuildingListPage />);
    fireEvent.click(screen.getByText("그린빌라"));
    await waitFor(() => expect(screen.getByText("101호")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /101호 삭제/ }));
    await waitFor(() =>
      expect(screen.getByText(/이 호실의 입주자 정보도 함께 삭제됩니다/)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(101);
    });
  });

  // --- New tests: missing form fields ---

  it("unit form modal contains 면적 field", async () => {
    render(<BuildingListPage />);
    fireEvent.click(screen.getByText("그린빌라"));
    await waitFor(() => expect(screen.getByText("101호")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /101호 수정/ }));
    await waitFor(() => expect(screen.getByText("호실 수정")).toBeInTheDocument());

    expect(screen.getByText("면적(평)", { selector: "label" })).toBeInTheDocument();
  });

  it("occupancy form modal contains 보증금 and 인원 fields", async () => {
    render(<BuildingListPage />);
    fireEvent.click(screen.getByText("그린빌라"));
    await waitFor(() => expect(screen.getByText("101호")).toBeInTheDocument());

    fireEvent.click(screen.getByText("101호"));
    await waitFor(() => expect(screen.getByText("김입주")).toBeInTheDocument());

    // Open the create occupancy modal via the + 입주 등록 button
    fireEvent.click(screen.getByRole("button", { name: /입주 등록/ }));
    await waitFor(() => expect(screen.getByText("입주 정보 등록")).toBeInTheDocument());

    expect(screen.getByText("보증금")).toBeInTheDocument();
    expect(screen.getByText("인원")).toBeInTheDocument();
  });
});
