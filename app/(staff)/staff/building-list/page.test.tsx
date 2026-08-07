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
    data: [],
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
});
