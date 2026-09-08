import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQueries: vi.fn(({ queries }: { queries: unknown[] }) => queries.map(() => ({
    data: rows,
    isLoading: false,
    error: null,
  }))),
}));
vi.mock("@/hooks/reactquery/utilities", () => ({
  useUtilityRows: vi.fn(),
  useFixedUsages: vi.fn(),
  useMeterHistory: vi.fn(),
  useSaveMeterReadings: vi.fn(),
  useBillingPeriod: vi.fn(),
  useSaveBillingPeriod: vi.fn(),
  useSaveWaterDiscount: vi.fn(),
  useDeleteWaterDiscount: vi.fn(),
  useSetFixedUsage: vi.fn(),
  useClearFixedUsage: vi.fn(),
  useUtilityPrices: vi.fn(),
  useSaveUtilityUnitPrices: vi.fn(),
  useScopedPrices: vi.fn(),
  useSaveScopedPrices: vi.fn(),
  listUtilityRows: vi.fn(),
  utilityKeys: {
    rows: (buildingId: number, utilityType: string, period: string) => ["utilities", "rows", buildingId, utilityType, period],
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useBillingPeriod,
  useClearFixedUsage,
  useDeleteWaterDiscount,
  useFixedUsages,
  useMeterHistory,
  useSaveBillingPeriod,
  useSaveMeterReadings,
  useSaveScopedPrices,
  useSaveUtilityUnitPrices,
  useSaveWaterDiscount,
  useScopedPrices,
  useSetFixedUsage,
  useUtilityPrices,
  useUtilityRows,
} from "@/hooks/reactquery/utilities";
import { WaterUtilitiesScreen as UtilitiesPage } from "./WaterUtilitiesScreen";

const buildings = [
  { id: 1, orgId: 9, code: "B001", name: "그린빌라", address: "서울시 강남구" },
  { id: 2, orgId: 9, code: "B002", name: "블루타워", address: "서울시 송파구" },
];
const rows = [
  {
    unitId: 101, unitNo: "101호", dong: null, occupancyId: 1001,
    tenantName: "홍길동", occupancyStatus: "occupied", moveInDate: null,
    customerNumber: "W-101", meterNumber: "M-101", previousReading: 100,
    currentReading: null, usage: null, unitPrice: 850, resolvedUnitPrice: 850,
    automaticCharge: 12000, manualCharge: null, note: null, processedAt: null,
    discountType: null, discountAmount: null,
  },
  {
    unitId: 201, unitNo: "201호", dong: null, occupancyId: null,
    tenantName: null, occupancyStatus: "vacant", moveInDate: null,
    customerNumber: null, meterNumber: null, previousReading: 40,
    currentReading: null, usage: null, unitPrice: null, resolvedUnitPrice: null,
    automaticCharge: null, manualCharge: null, note: null, processedAt: null,
    discountType: null, discountAmount: null,
  },
];

const mutation = { mutate: vi.fn(), isPending: false };
const refetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/staff/utilities?type=water");
  vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: ["utilities"] } } as never);
  vi.mocked(useBuildings).mockReturnValue({ data: buildings, isLoading: false, error: null, refetch } as never);
  vi.mocked(useUtilityRows).mockReturnValue({ data: rows, isLoading: false, error: null, refetch } as never);
  vi.mocked(useFixedUsages).mockReturnValue({ data: [], isLoading: false, error: null, refetch } as never);
  vi.mocked(useMeterHistory).mockReturnValue({ data: [{ period: "2026-07-01", unitPrice: 800, charge: 11000 }], isLoading: false, error: null } as never);
  vi.mocked(useBillingPeriod).mockReturnValue({ data: { chargeStartDate: "2026-07-16", chargeEndDate: "2026-08-15", dueDate: null }, isLoading: false, error: null } as never);
  vi.mocked(useSaveBillingPeriod).mockReturnValue(mutation as never);
  vi.mocked(useSaveMeterReadings).mockReturnValue(mutation as never);
  vi.mocked(useSaveWaterDiscount).mockReturnValue(mutation as never);
  vi.mocked(useDeleteWaterDiscount).mockReturnValue(mutation as never);
  vi.mocked(useSetFixedUsage).mockReturnValue(mutation as never);
  vi.mocked(useClearFixedUsage).mockReturnValue(mutation as never);
  vi.mocked(useUtilityPrices).mockReturnValue({ data: [], isLoading: false, error: null } as never);
  vi.mocked(useSaveUtilityUnitPrices).mockReturnValue(mutation as never);
  vi.mocked(useScopedPrices).mockReturnValue({ data: [], isLoading: false, error: null } as never);
  vi.mocked(useSaveScopedPrices).mockReturnValue(mutation as never);
});

function selectBuilding() {
  fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "1" } });
}

describe("UtilitiesPage Figma states", () => {
  it("권한이 없으면 접근을 차단한다", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: [] } } as never);
    render(<UtilitiesPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });

  it("초기 상태에서 좌측 건물 목록과 비선택 안내를 표시한다", () => {
    render(<UtilitiesPage />);
    expect(screen.getByText("전체 건물")).toBeInTheDocument();
    expect(screen.getAllByText("건물을 선택해 주세요", { selector: "p" })).toHaveLength(2);
  });

  it("건물을 선택하면 조회 상태의 고객번호 요약과 호실 지침을 표시한다", async () => {
    render(<UtilitiesPage />);
    selectBuilding();
    expect(await screen.findByRole("heading", { name: "그린빌라" })).toBeInTheDocument();
    expect(screen.getByText("호실별 수도 지침")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.queryByLabelText("101호 당월 지침값")).not.toBeInTheDocument();
    expect(screen.getByText("최근 6개월 이력")).toBeInTheDocument();
  });

  it("수정 상태에서 지침 입력을 활성화하고 공실 입력은 잠근다", async () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(await screen.findByRole("button", { name: "수정" }));
    for (const field of ["전월 지침값", "당월 지침값", "사용량", "수동 입력 요금", "적요"]) {
      expect(screen.getByLabelText(`101호 ${field}`)).toBeEnabled();
      expect(screen.getByLabelText(`201호 ${field}`)).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "계산" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });

  it("계산은 편집한 호실을 현재 건물·유형·월로 저장한다", async () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(await screen.findByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("101호 전월 지침값"), { target: { value: "99" } });
    fireEvent.change(screen.getByLabelText("101호 당월 지침값"), { target: { value: "158" } });
    fireEvent.change(screen.getByLabelText("101호 사용량"), { target: { value: "59" } });
    fireEvent.click(screen.getByRole("button", { name: "계산" }));
    expect(mutation.mutate).toHaveBeenCalledWith(expect.objectContaining({
      buildingId: 1,
      utilityType: "water",
      rows: [expect.objectContaining({
        unit_id: 101,
        previous_reading: "99",
        current_reading: "158",
        usage: "59",
      })],
    }), expect.anything());
  });

  it("검침대장 출력 모달에서 선택 건물을 출력하고 완료 토스트를 표시한다", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("button", { name: "검침대장 출력" }));
    expect(screen.getByRole("dialog", { name: "검침대장 출력" })).toBeInTheDocument();
    expect(screen.getByTestId("meter-ledger-preview")).toHaveTextContent("수도검침");
    fireEvent.click(screen.getByRole("button", { name: "인쇄" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("검침대장 출력 처리되었습니다.");
    print.mockRestore();
  });

  it("전체 이월 버튼은 확인 대화상자를 거쳐 다음 달로 이동한다", async () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("button", { name: "전체 이월" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이월" }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("다음 달로 이월"));
  });

  it("수도 전용 화면은 water 조회 범위를 유지한다", () => {
    render(<UtilitiesPage />);
    selectBuilding();
    expect(useUtilityRows).toHaveBeenLastCalledWith(1, "water", expect.stringMatching(/^\d{4}-\d{2}-01$/));
    expect(screen.getByRole("heading", { name: "수도" })).toBeInTheDocument();
  });
});
