import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock hooks
vi.mock("@/hooks/reactquery/buildingTypes", () => ({
  useBuildingTypes: vi.fn(),
  useCreateBuildingType: vi.fn(),
  useRenameBuildingType: vi.fn(),
  useDeleteBuildingType: vi.fn(),
}));

vi.mock("@/hooks/reactquery/feeItems", () => ({
  useFeeItems: vi.fn(),
  useCreateFeeItem: vi.fn(),
  useUpdateFeeItem: vi.fn(),
  useDeleteFeeItem: vi.fn(),
  useReorderFeeItems: vi.fn(),
}));

vi.mock("@/hooks/reactquery/auth", () => ({
  useMe: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import FeeItemPage from "./page";
import {
  useBuildingTypes,
  useCreateBuildingType,
  useRenameBuildingType,
  useDeleteBuildingType,
} from "@/hooks/reactquery/buildingTypes";
import {
  useFeeItems,
  useCreateFeeItem,
  useUpdateFeeItem,
  useDeleteFeeItem,
  useReorderFeeItems,
} from "@/hooks/reactquery/feeItems";
import { useMe } from "@/hooks/reactquery/auth";

const mockBuildingTypes = [
  { id: 1, orgId: 10, label: "빌라", sortOrder: 0 },
  { id: 2, orgId: 10, label: "빌딩", sortOrder: 1 },
];

const mockBuildingTypesSingle = [
  { id: 1, orgId: 10, label: "빌라", sortOrder: 0 },
];

const mockFeeItemsType1 = [
  {
    id: 1, orgId: 10, typeId: 1, name: "전기", rounding: "round",
    dailyProration: true, carryOver: false, isRequired: true, sortOrder: 0,
  },
  {
    id: 2, orgId: 10, typeId: 1, name: "수도", rounding: "round",
    dailyProration: true, carryOver: false, isRequired: true, sortOrder: 1,
  },
  {
    id: 3, orgId: 10, typeId: 1, name: "관리비", rounding: "round",
    dailyProration: false, carryOver: false, isRequired: false, sortOrder: 2,
  },
];

const mockFeeItemsType2 = [
  {
    id: 10, orgId: 10, typeId: 2, name: "가스", rounding: "up",
    dailyProration: false, carryOver: false, isRequired: true, sortOrder: 0,
  },
  {
    id: 11, orgId: 10, typeId: 2, name: "주차비", rounding: "down",
    dailyProration: false, carryOver: false, isRequired: false, sortOrder: 1,
  },
];

const mockMutate = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };

function setupMocks(types = mockBuildingTypes) {
  vi.mocked(useBuildingTypes).mockReturnValue({
    data: types,
    isLoading: false,
  } as any);

  vi.mocked(useFeeItems).mockImplementation((typeId: number) => ({
    data: typeId === 1 ? mockFeeItemsType1 : typeId === 2 ? mockFeeItemsType2 : [],
    isLoading: false,
  } as any));

  vi.mocked(useMe).mockReturnValue({ data: { orgId: 10 } } as any);

  vi.mocked(useCreateBuildingType).mockReturnValue(mockMutate as any);
  vi.mocked(useRenameBuildingType).mockReturnValue(mockMutate as any);
  vi.mocked(useDeleteBuildingType).mockReturnValue(mockMutate as any);
  vi.mocked(useCreateFeeItem).mockReturnValue(mockMutate as any);
  vi.mocked(useUpdateFeeItem).mockReturnValue(mockMutate as any);
  vi.mocked(useDeleteFeeItem).mockReturnValue(mockMutate as any);
  vi.mocked(useReorderFeeItems).mockReturnValue(mockMutate as any);
}

describe("FeeItemPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mutateAsync.mockResolvedValue({});
    setupMocks();
  });

  it("renders building-type tabs 빌라 and 빌딩", () => {
    render(<FeeItemPage />);
    expect(screen.getByText("빌라")).toBeInTheDocument();
    expect(screen.getByText("빌딩")).toBeInTheDocument();
  });

  it("renders fee items for the first tab by default", () => {
    render(<FeeItemPage />);
    expect(screen.getByText("전기")).toBeInTheDocument();
    expect(screen.getByText("수도")).toBeInTheDocument();
    expect(screen.getByText("관리비")).toBeInTheDocument();
  });

  it("switching to 빌딩 tab loads that type's items", async () => {
    render(<FeeItemPage />);
    fireEvent.click(screen.getByText("빌딩"));
    await waitFor(() => {
      expect(screen.getByText("가스")).toBeInTheDocument();
      expect(screen.getByText("주차비")).toBeInTheDocument();
    });
  });

  it("renders ＋ 항목 추가 button", () => {
    render(<FeeItemPage />);
    expect(screen.getByRole("button", { name: /항목 추가/ })).toBeInTheDocument();
  });

  it("clicking ＋ 항목 추가 opens the fee item form modal", async () => {
    render(<FeeItemPage />);
    fireEvent.click(screen.getByRole("button", { name: /항목 추가/ }));
    await waitFor(() => {
      expect(screen.getByText("항목 추가")).toBeInTheDocument();
    });
  });

  it("required item (전기) does NOT show a delete button", () => {
    render(<FeeItemPage />);
    // The required item row must not contain a delete button
    // We look for delete buttons associated with required items
    const rows = screen.getAllByRole("row");
    const electricRow = rows.find((r) => r.textContent?.includes("전기"));
    expect(electricRow).toBeDefined();
    // No delete button within the required row
    const deleteBtn = electricRow?.querySelector("button[data-delete]");
    expect(deleteBtn).toBeNull();
  });

  it("non-required item (관리비) shows a delete button", () => {
    render(<FeeItemPage />);
    // Find delete button for 관리비 row
    const deleteBtn = screen.getByRole("button", { name: /관리비 삭제/ });
    expect(deleteBtn).toBeInTheDocument();
  });

  it("required items are pinned at the top above non-required items", () => {
    render(<FeeItemPage />);
    const rows = screen.getAllByRole("row").filter((r) => r.textContent?.trim());
    const names = rows.map((r) => {
      if (r.textContent?.includes("전기")) return "전기";
      if (r.textContent?.includes("수도")) return "수도";
      if (r.textContent?.includes("관리비")) return "관리비";
      return null;
    }).filter(Boolean);

    const elecIdx = names.indexOf("전기");
    const suIdx = names.indexOf("수도");
    const mgmtIdx = names.indexOf("관리비");

    expect(elecIdx).toBeLessThan(mgmtIdx);
    expect(suIdx).toBeLessThan(mgmtIdx);
  });

  // E — new tests for Tabs rename/delete UI

  it("double-clicking active type tab label shows a rename input and submitting calls rename mutation", async () => {
    const user = userEvent.setup();
    const renameMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useRenameBuildingType).mockReturnValue({ mutateAsync: renameMutateAsync, isPending: false } as any);

    render(<FeeItemPage />);

    // Double-click the "빌라" tab label
    const billaTab = screen.getByText("빌라");
    await user.dblClick(billaTab);

    // Rename input should appear
    const renameInput = screen.getByRole("textbox", { name: "유형 이름 변경" });
    expect(renameInput).toBeInTheDocument();

    // Clear and type a new name
    await user.clear(renameInput);
    await user.type(renameInput, "아파트");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(renameMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ label: "아파트" })
      );
    });
  });

  it("clicking × delete button calls delete mutation when >1 type exists", async () => {
    const deleteMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useDeleteBuildingType).mockReturnValue({ mutateAsync: deleteMutateAsync, isPending: false } as any);

    render(<FeeItemPage />);

    // × button should appear next to each tab (>1 type)
    const deleteButtons = screen.getAllByRole("button", { name: "유형 삭제" });
    expect(deleteButtons.length).toBeGreaterThan(0);

    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteMutateAsync).toHaveBeenCalled();
    });
  });

  it("clicking × delete button is blocked when only ONE type exists", async () => {
    setupMocks(mockBuildingTypesSingle);
    const deleteMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useDeleteBuildingType).mockReturnValue({ mutateAsync: deleteMutateAsync, isPending: false } as any);

    render(<FeeItemPage />);

    // With only 1 type, BuildingTypeTabs passes undefined for onDelete → no × button rendered
    const deleteButtons = screen.queryAllByRole("button", { name: "유형 삭제" });
    expect(deleteButtons.length).toBe(0);
    expect(deleteMutateAsync).not.toHaveBeenCalled();
  });
});
