import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  typeRefetch: vi.fn(),
  itemRefetch: vi.fn(),
  typeUsage: vi.fn(),
  renameType: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: mocks.toastError, success: vi.fn(), info: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildingTypes", () => ({
  useBuildingTypes: vi.fn(),
  createBuildingType: vi.fn(),
  deleteBuildingType: vi.fn(),
  renameBuildingType: mocks.renameType,
  reorderBuildingTypes: vi.fn(),
  getBuildingTypeUsage: mocks.typeUsage,
  buildingTypeKeys: { all: ["buildingTypes"] },
}));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/feeItems", () => ({
  useAllFeeItems: vi.fn(),
  createFeeItem: vi.fn(),
  deleteFeeItem: vi.fn(),
  reorderFeeItems: vi.fn(),
  updateFeeItem: vi.fn(),
  feeItemKeys: { all: ["feeItems"] },
}));

import { useMe } from "@/hooks/reactquery/auth";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useAllFeeItems } from "@/hooks/reactquery/feeItems";
import FeeItemsPage from "./page";

const buildingTypes = [
  { id: 1, orgId: 9, label: "빌라", sortOrder: 0 },
  { id: 2, orgId: 9, label: "빌딩", sortOrder: 1 },
];

const feeItems = [
  ["전기", true],
  ["수도료", true],
  ["가스", true],
  ["공용수도료", false],
  ["일반관리비", false],
  ["승강기유지비", false],
  ["정화조", false],
  ["수리비", false],
].map(([name, isRequired], index) => ({
  id: index + 1,
  orgId: 9,
  typeId: 1,
  name,
  rounding: "round",
  dailyProration: true,
  carryOver: true,
  isRequired,
  sortOrder: index,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.typeUsage.mockResolvedValue({ buildings: false, billing: false });
  mocks.renameType.mockResolvedValue({ id: 1 });
  mocks.typeRefetch.mockResolvedValue({ data: buildingTypes });
  mocks.itemRefetch.mockResolvedValue({ data: feeItems });
  vi.mocked(useMe).mockReturnValue({
    data: { orgId: 9, role: "staff", permissions: ["fee_items"] },
  } as never);
  vi.mocked(useBuildingTypes).mockReturnValue({
    data: buildingTypes,
    isLoading: false,
    isError: false,
    refetch: mocks.typeRefetch,
  } as never);
  vi.mocked(useAllFeeItems).mockReturnValue({
    data: feeItems,
    isLoading: false,
    isError: false,
    refetch: mocks.itemRefetch,
  } as never);
  vi.mocked(useBuildings).mockReturnValue({ data: [], isLoading: false } as never);
});

describe("FeeItemsPage", () => {
  it("renders the Figma default state with type tabs and fee item policies", () => {
    render(<FeeItemsPage />);

    expect(screen.getByRole("navigation", { name: "건물 유형" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "빌라" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "빌딩" })).toBeInTheDocument();
    expect(screen.getByText("8개")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /전기/ })).toBeInTheDocument();
    expect(screen.getAllByText("필수")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "항목 추가" })).toBeInTheDocument();
  });

  it("creates a new type with the three locked required items", () => {
    render(<FeeItemsPage />);

    fireEvent.click(screen.getByRole("button", { name: "건물 유형 추가" }));

    expect(screen.getByRole("button", { name: "유형명" })).toBeInTheDocument();
    expect(screen.getByText("3개")).toBeInTheDocument();
    expect(screen.getAllByText("필수")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "변경 내용 저장" })).toBeInTheDocument();
  });

  it("opens the add dialog with the PRD defaults", () => {
    render(<FeeItemsPage />);

    fireEvent.click(screen.getByRole("button", { name: "항목 추가" }));

    expect(screen.getByRole("form", { name: "관리 항목 추가" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("예: 일반관리비")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "반올림" })).toHaveValue("round");
    expect(screen.getByRole("combobox", { name: "일자계산" })).toHaveValue("true");
    expect(screen.getByRole("combobox", { name: "이월" })).toHaveValue("false");
  });

  it("shows the destructive type confirmation with its item count", async () => {
    render(<FeeItemsPage />);

    fireEvent.click(screen.getByRole("button", { name: "건물 유형 삭제" }));

    expect(await screen.findByRole("alertdialog", { name: "유형 삭제" })).toBeInTheDocument();
    expect(screen.getByText(/등록된 관리 항목 8개/)).toBeInTheDocument();
    expect(screen.getByText(/되돌릴 수 없어요/)).toBeInTheDocument();
  });

  it("blocks deleting a type that is assigned or has billing history", async () => {
    mocks.typeUsage.mockResolvedValue({ buildings: false, billing: true });
    render(<FeeItemsPage />);

    fireEvent.click(screen.getByRole("button", { name: "건물 유형 삭제" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("건물 또는 부과 내역에 사용 중인 유형은 삭제할 수 없습니다."));
    expect(screen.queryByRole("alertdialog", { name: "유형 삭제" })).not.toBeInTheDocument();
  });

  it("stages a type rename and persists it only after explicit save", async () => {
    render(<FeeItemsPage />);

    fireEvent.click(screen.getByRole("button", { name: "건물 유형명 수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "건물 유형명" }), { target: { value: "다가구" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "건물 유형명" }));

    expect(mocks.renameType).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "변경 내용 저장" }));
    await waitFor(() => expect(mocks.renameType).toHaveBeenCalledWith(1, "다가구"));
  });

  it("uses the dedicated fee-items permission", () => {
    vi.mocked(useMe).mockReturnValue({ data: { orgId: 9, role: "staff", permissions: ["billing"] } } as never);

    render(<FeeItemsPage />);

    expect(screen.getByText("권한이 없습니다")).toBeInTheDocument();
  });
});
