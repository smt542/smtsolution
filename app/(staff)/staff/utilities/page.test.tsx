import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/utilities", () => ({
  useUtilityRows: vi.fn(),
  useMeterHistory: vi.fn(),
  useSaveMeterReadings: vi.fn(),
  useSaveWaterDiscount: vi.fn(),
  useDeleteWaterDiscount: vi.fn(),
  useUtilityPrices: vi.fn(),
  useSaveUtilityUnitPrices: vi.fn(),
  useUtilityConfirmation: vi.fn(),
  useConfirmUtilities: vi.fn(),
  ledgerDownloadUrl: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { toast } from "sonner";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useUtilityRows,
  useMeterHistory,
  useSaveMeterReadings,
  useSaveWaterDiscount,
  useDeleteWaterDiscount,
  useUtilityPrices,
  useSaveUtilityUnitPrices,
  useUtilityConfirmation,
  useConfirmUtilities,
} from "@/hooks/reactquery/utilities";
import UtilitiesPage from "./page";

const buildings = [
  { id: 1, orgId: 9, code: "B001", name: "그린빌라" },
  { id: 2, orgId: 9, code: "B002", name: "블루타워" },
];

const rows = [
  {
    unitId: 101,
    unitNo: "101호",
    dong: null,
    occupancyId: 1001,
    tenantName: "홍길동",
    occupancyStatus: "occupied",
    moveInDate: "2026-08-01",
    customerNumber: "W-101",
    meterNumber: null,
    previousReading: null,
    currentReading: null,
    usage: null,
    automaticCharge: null,
    manualCharge: null,
    note: null,
    processedAt: null,
    discountType: null,
    discountAmount: null,
  },
  {
    unitId: 201,
    unitNo: "201호",
    dong: null,
    occupancyId: null,
    tenantName: null,
    occupancyStatus: null,
    moveInDate: null,
    customerNumber: null,
    meterNumber: null,
    previousReading: null,
    currentReading: null,
    usage: null,
    automaticCharge: null,
    manualCharge: null,
    note: null,
    processedAt: null,
    discountType: null,
    discountAmount: null,
  },
];

const refetch = vi.fn();
const saveMutate = vi.fn();

function setupMocks() {
  vi.mocked(useMe).mockReturnValue({
    data: { role: "staff", permissions: ["utilities"] },
  } as never);
  vi.mocked(useBuildings).mockReturnValue({
    data: buildings,
    isLoading: false,
    error: null,
    refetch,
  } as never);
  vi.mocked(useUtilityRows).mockReturnValue({
    data: rows,
    isLoading: false,
    error: null,
    refetch,
  } as never);
  vi.mocked(useMeterHistory).mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useSaveMeterReadings).mockReturnValue({
    mutate: saveMutate,
    isPending: false,
  } as never);
  vi.mocked(useSaveWaterDiscount).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useDeleteWaterDiscount).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useUtilityPrices).mockReturnValue({
    data: [{
      customerNumberId: 11,
      customerNo: "W-APT",
      holderName: "주택용",
      sortOrder: 0,
      unitPrice: 850,
    }],
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useSaveUtilityUnitPrices).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
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
}

function selectBuilding() {
  fireEvent.change(screen.getByLabelText("건물 선택"), {
    target: { value: "1" },
  });
}

describe("UtilitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("utilities 권한이 없으면 화면 접근을 차단한다", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { role: "staff", permissions: [] },
    } as never);

    render(<UtilitiesPage />);

    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("전기·수도·가스 지침·부과")).not.toBeInTheDocument();
  });

  it("건물 선택 전 초기 안내를 표시한다", () => {
    render(<UtilitiesPage />);
    expect(screen.getByText("건물을 선택해 주세요", { selector: "p" })).toBeInTheDocument();
  });

  it("건물을 선택하면 실제 세대 행을 표시하고 공실 입력을 비활성화한다", () => {
    render(<UtilitiesPage />);
    selectBuilding();

    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("공실")).toBeInTheDocument();
    expect(screen.getByLabelText("101호 당월 지침값")).toBeEnabled();
    expect(screen.getByLabelText("201호 당월 지침값")).toBeDisabled();
  });

  it("당월 값 입력을 로컬 요약에 반영한다", () => {
    render(<UtilitiesPage />);
    selectBuilding();

    fireEvent.change(screen.getByLabelText("101호 당월 지침값"), {
      target: { value: "358" },
    });

    expect(screen.getByLabelText("101호 당월 지침값")).toHaveValue(358);
    const completedCard = screen.getByText("당월 입력").parentElement;
    expect(completedCard).toHaveTextContent("1");
  });

  it("전기 탭으로 전환하면 전기 유형·기준월로 조회 키를 사용한다", async () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("button", { name: "전기" }));

    await waitFor(() => {
      expect(useUtilityRows).toHaveBeenLastCalledWith(
        1,
        "electricity",
        expect.stringMatching(/^\d{4}-\d{2}-01$/),
      );
    });
    expect(screen.getByText("세대별 전기 지침")).toBeInTheDocument();
  });

  it("세대 행을 클릭하면 6개월 이력 표를 연다", () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(screen.getByText("홍길동"));

    expect(screen.getByText("101호 수도 6개월 이력")).toBeInTheDocument();
    expect(screen.getByText("전월 대비 증감")).toBeInTheDocument();
  });

  it("수도 탭에서 세대 할인 버튼으로 할인 설정 모달을 연다", () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(screen.getByLabelText("101호 수도 할인 설정"));

    expect(screen.getByLabelText("할인 구분")).toBeInTheDocument();
    expect(screen.getByLabelText("할인 금액")).toBeInTheDocument();
  });

  it("단가 설정 버튼으로 현재 유형의 고객번호별 단가 모달을 연다", () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("button", { name: "단가 설정" }));

    expect(screen.getByText("수도 단가 설정")).toBeInTheDocument();
    expect(screen.getByLabelText("W-APT 단가")).toHaveValue(850);
  });

  it("부과 계산은 입력된 당월 지침을 save_meter_readings로 저장한다", () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.change(screen.getByLabelText("101호 당월 지침값"), {
      target: { value: "158" },
    });
    fireEvent.click(screen.getByRole("button", { name: "부과 계산" }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const [payload] = saveMutate.mock.calls[0];
    expect(payload).toMatchObject({
      buildingId: 1,
      utilityType: "water",
      rows: [{ unit_id: 101, current_reading: "158", manual_charge: "", note: "" }],
    });
    expect(payload.period).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("입력된 지침이 없으면 저장하지 않고 안내한다", () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("button", { name: "부과 계산" }));

    expect(saveMutate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("입력된 당월 지침이 없습니다.");
  });

  it("검침대장 다운은 서버 생성 안내를 표시한다", () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("button", { name: "검침대장 다운" }));

    expect(toast.info).toHaveBeenCalledWith(
      "검침대장 엑셀 내보내기는 서버 생성 기능 연동 후 제공됩니다.",
    );
  });
});
