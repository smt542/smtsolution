import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/utilities", () => ({
  useUtilityRows: vi.fn(),
  useFixedUsages: vi.fn(),
  useUtilityConfirmation: vi.fn(),
  useConfirmUtilities: vi.fn(),
  useSaveMeterReadings: vi.fn(),
  useMeterHistory: vi.fn(),
  useSaveWaterDiscount: vi.fn(),
  useDeleteWaterDiscount: vi.fn(),
  useSetFixedUsage: vi.fn(),
  useClearFixedUsage: vi.fn(),
  useUtilityPrices: vi.fn(),
  useSaveUtilityUnitPrices: vi.fn(),
  useScopedPrices: vi.fn(),
  useSaveScopedPrices: vi.fn(),
  useBillingPeriod: vi.fn(),
  useSaveBillingPeriod: vi.fn(),
  useUtilitySupplier: vi.fn(),
  useSaveUtilitySupplier: vi.fn(),
  ledgerDownloadUrl: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { toast } from "sonner";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useBillingPeriod,
  useClearFixedUsage,
  useConfirmUtilities,
  useDeleteWaterDiscount,
  useFixedUsages,
  useMeterHistory,
  useSaveBillingPeriod,
  useSaveMeterReadings,
  useSaveScopedPrices,
  useSaveUtilitySupplier,
  useSaveUtilityUnitPrices,
  useSaveWaterDiscount,
  useScopedPrices,
  useSetFixedUsage,
  useUtilityConfirmation,
  useUtilityPrices,
  useUtilityRows,
  useUtilitySupplier,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import UtilitiesPage from "../page";

const activeRow: UtilityUnitRow = {
  unitId: 101,
  unitNo: "101호",
  dong: null,
  occupancyId: 1001,
  tenantName: "홍길동",
  occupancyStatus: "occupied",
  moveInDate: null,
  customerNumber: "G-1",
  meterNumber: "M-1",
  previousReading: 41,
  currentReading: null,
  usage: null,
  unitPrice: 100,
  resolvedUnitPrice: 100,
  automaticCharge: null,
  manualCharge: null,
  note: null,
  processedAt: null,
  discountType: null,
  discountAmount: null,
};

const rows: UtilityUnitRow[] = [
  activeRow,
  {
    ...activeRow,
    unitId: 102,
    unitNo: "102호",
    tenantName: "고정세대",
    previousReading: 50,
  },
  {
    ...activeRow,
    unitId: 103,
    unitNo: "103호",
    tenantName: "입력세대",
    previousReading: 55,
    currentReading: 60,
  },
  {
    ...activeRow,
    unitId: 201,
    unitNo: "201호",
    occupancyId: null,
    tenantName: null,
    occupancyStatus: "vacant",
    customerNumber: null,
    previousReading: 70,
  },
];

const mutation = { mutate: vi.fn(), isPending: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMe).mockReturnValue({
    data: { role: "staff", permissions: ["utilities"] },
  } as never);
  vi.mocked(useBuildings).mockReturnValue({
    data: [{ id: 1, name: "그린빌라" }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useUtilityRows).mockReturnValue({
    data: rows,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useFixedUsages).mockReturnValue({
    data: [{ unitId: 102, fixedUsage: 5, fromMonth: "2026-08-01" }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useUtilityConfirmation).mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useConfirmUtilities).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useSaveMeterReadings).mockReturnValue(mutation as never);
  vi.mocked(useMeterHistory).mockReturnValue({ data: [], isLoading: false, error: null } as never);
  vi.mocked(useSaveWaterDiscount).mockReturnValue(mutation as never);
  vi.mocked(useDeleteWaterDiscount).mockReturnValue(mutation as never);
  vi.mocked(useSetFixedUsage).mockReturnValue(mutation as never);
  vi.mocked(useClearFixedUsage).mockReturnValue(mutation as never);
  vi.mocked(useUtilityPrices).mockReturnValue({ data: [], isLoading: false, error: null } as never);
  vi.mocked(useSaveUtilityUnitPrices).mockReturnValue(mutation as never);
  vi.mocked(useScopedPrices).mockReturnValue({ data: [], isLoading: false, error: null } as never);
  vi.mocked(useSaveScopedPrices).mockReturnValue(mutation as never);
  vi.mocked(useBillingPeriod).mockReturnValue({ data: null, isLoading: false, error: null } as never);
  vi.mocked(useSaveBillingPeriod).mockReturnValue(mutation as never);
  vi.mocked(useUtilitySupplier).mockReturnValue({ data: null, isLoading: false, error: null } as never);
  vi.mocked(useSaveUtilitySupplier).mockReturnValue(mutation as never);
});

function selectBuildingAndGas() {
  fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "가스" }));
}

describe("UtilitiesPage gas wiring", () => {
  it("수도에는 가스 기능이 없고 가스 탭에만 모든 진입점과 기준일·라인 필터가 표시된다", () => {
    render(<UtilitiesPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "1" } });

    expect(screen.queryByRole("button", { name: "가스 공급자정보" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "검침대장 출력" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "전체 이월" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("라인 필터")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "가스" }));
    expect(screen.getByRole("button", { name: "가스 공급자정보" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "검침대장 출력" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "검침대장 다운" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체 이월" })).toBeInTheDocument();
    expect(screen.getByText("부과기준일을 먼저 설정해 주세요.")).toBeInTheDocument();
    expect(screen.getByLabelText("라인 필터")).toBeInTheDocument();
  });

  it("전체 이월은 빈 활성·비고정 세대만 전월 지침으로 채운다", () => {
    render(<UtilitiesPage />);
    selectBuildingAndGas();
    fireEvent.click(screen.getByRole("button", { name: "전체 이월" }));

    expect(screen.getByLabelText("101호 당월 지침값")).toHaveValue(41);
    expect(screen.getByLabelText("102호 당월 지침값")).toBeDisabled();
    expect(screen.getByLabelText("103호 당월 지침값")).toHaveValue(60);
    expect(screen.getByLabelText("201호 당월 지침값")).toBeDisabled();
    expect(toast.success).toHaveBeenCalledWith("1개 세대를 전체 이월했습니다.");
  });

  it("미지정 라인을 선택하면 고객번호가 없는 세대만 표에 표시한다", () => {
    render(<UtilitiesPage />);
    selectBuildingAndGas();
    fireEvent.change(screen.getByLabelText("라인 필터"), {
      target: { value: "__unassigned__" },
    });

    expect(screen.queryByText("홍길동")).not.toBeInTheDocument();
    expect(screen.getByText("공실")).toBeInTheDocument();
  });
});
