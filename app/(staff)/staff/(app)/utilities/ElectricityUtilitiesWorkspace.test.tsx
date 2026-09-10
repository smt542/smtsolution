import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/buildingCustomerNumbers", () => ({ useCustomerNumberLookup: vi.fn() }));
vi.mock("@/hooks/reactquery/utilities", () => ({
  useUtilityRows: vi.fn(),
  useFixedUsages: vi.fn(),
  useUtilityPrices: vi.fn(),
  useBillingPeriod: vi.fn(),
  useSaveMeterReadings: vi.fn(),
  useSaveBillingPeriod: vi.fn(),
  useSaveUtilityUnitPrices: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("./components/MeterLedgerModal", () => ({
  MeterLedgerModal: ({ open }: { open: boolean }) => open
    ? <div role="dialog" aria-label="검침대장 출력">검침대장 출력</div>
    : null,
}));

import { toast } from "sonner";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useCustomerNumberLookup } from "@/hooks/reactquery/buildingCustomerNumbers";
import {
  useBillingPeriod,
  useFixedUsages,
  useSaveBillingPeriod,
  useSaveMeterReadings,
  useSaveUtilityUnitPrices,
  useUtilityPrices,
  useUtilityRows,
} from "@/hooks/reactquery/utilities";
import UtilitiesPage from "./ElectricityUtilitiesWorkspace";

const buildings = [
  {
    id: 1,
    orgId: 9,
    code: "B001",
    name: "그린빌라",
    address: "서울 강서구 화곡로 12",
    typeId: null,
    ownerName: null,
    ownerPhone: null,
    entrancePassword: null,
    managerUserId: null,
    meterUserId: null,
    cleaningUserId: null,
    facilities: {},
    memo: null,
    billingNote: null,
    setupConfirmRequired: false,
  },
];

const rows = [
  {
    unitId: 101,
    unitNo: "101호",
    dong: null,
    occupancyId: 1001,
    tenantName: "홍길동",
    occupancyStatus: "occupied",
    moveInDate: "2023-06-18",
    customerNumber: "1000007919",
    meterNumber: "M-1",
    previousReading: 472,
    currentReading: null,
    usage: null,
    unitPrice: 49.3,
    resolvedUnitPrice: 49.3,
    automaticCharge: 5280,
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
    occupancyStatus: "vacant",
    moveInDate: null,
    customerNumber: null,
    meterNumber: null,
    previousReading: 90,
    currentReading: null,
    usage: null,
    unitPrice: null,
    resolvedUnitPrice: null,
    automaticCharge: null,
    manualCharge: null,
    note: null,
    processedAt: null,
    discountType: null,
    discountAmount: null,
  },
];

const meterSave = vi.fn();
const periodSave = vi.fn();
const priceSave = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  meterSave.mockResolvedValue({ saved: 1, period: "2026-07-01" });
  periodSave.mockResolvedValue(undefined);
  priceSave.mockResolvedValue({ saved: 1 });
  vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: ["utilities"] } } as never);
  vi.mocked(useBuildings).mockReturnValue({ data: buildings, isLoading: false, error: null } as never);
  vi.mocked(useCustomerNumberLookup).mockReturnValue({
    data: { rows: [{ id: 11, buildingId: 1, buildingName: "그린빌라", kind: "elec", customerNo: "1000007919" }], total: 1 },
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useUtilityRows).mockReturnValue({ data: rows, isLoading: false, error: null, refetch: vi.fn() } as never);
  vi.mocked(useFixedUsages).mockReturnValue({ data: [], isLoading: false, error: null } as never);
  vi.mocked(useUtilityPrices).mockReturnValue({
    data: [{ customerNumberId: 11, customerNo: "1000007919", holderName: null, sortOrder: 0, unitPrice: 49.3 }],
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useBillingPeriod).mockReturnValue({
    data: { chargeStartDate: "2026-06-16", chargeEndDate: "2026-07-15", dueDate: null },
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useSaveMeterReadings).mockReturnValue({ mutateAsync: meterSave, isPending: false } as never);
  vi.mocked(useSaveBillingPeriod).mockReturnValue({ mutateAsync: periodSave, isPending: false } as never);
  vi.mocked(useSaveUtilityUnitPrices).mockReturnValue({ mutateAsync: priceSave, isPending: false } as never);
});

function selectBuilding() {
  fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "1" } });
}

describe("UtilitiesPage Figma electricity states", () => {
  it("와이어프레임 상단 헤더와 액션을 표시한다", () => {
    render(<UtilitiesPage />);

    expect(screen.getByText("공과금 관리")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "전기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "검침대장 출력" }));
    expect(screen.getByRole("dialog", { name: "검침대장 출력" })).toBeInTheDocument();
  });

  it("권한이 없으면 접근을 차단한다", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: [] } } as never);
    render(<UtilitiesPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });

  it("초기에는 2026년 7월분과 건물 미선택 상태를 표시한다", () => {
    render(<UtilitiesPage />);
    expect(screen.getByText("건물 미선택")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월분 부과 편집")).toBeInTheDocument();
    expect(screen.getAllByText("건물을 선택해 주세요").length).toBeGreaterThanOrEqual(2);
    expect(useUtilityRows).toHaveBeenCalledWith(null, "electricity", "2026-07-01");
  });

  it("건물을 선택하면 고객번호 요약과 호실별 지침을 표시한다", () => {
    render(<UtilitiesPage />);
    selectBuilding();
    expect(screen.getAllByText("그린빌라").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1000007919").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "퇴실예정일자" })).toBeInTheDocument();
  });

  it("수정 모드에서 입력 필드를 열고 전기 저장 훅을 호출한다", async () => {
    render(<UtilitiesPage />);
    selectBuilding();
    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    expect(screen.getByLabelText("연도 선택")).toBeDisabled();
    expect(screen.getByLabelText("1번 고객번호")).toBeEnabled();
    expect(screen.getByLabelText("1000007919 부과액")).toBeEnabled();
    expect(screen.getByLabelText("201호 당월 지침값")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("101호 당월 지침값"), { target: { value: "488" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(meterSave).toHaveBeenCalledWith(expect.objectContaining({
      buildingId: 1,
      utilityType: "electricity",
      period: "2026-07-01",
      rows: [expect.objectContaining({ unit_id: 101, current_reading: "488" })],
    })));
    expect(periodSave).toHaveBeenCalledWith(expect.objectContaining({ chargeStartDate: "2026-06-16", chargeEndDate: "2026-07-15" }));
    expect(priceSave).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("전기 지침과 부과기준을 저장했습니다.");
  });

  it("상단 이벤트로 검침대장 출력 상태를 연다", () => {
    render(<UtilitiesPage />);
    act(() => window.dispatchEvent(new CustomEvent("utilities:print")));
    expect(screen.getByRole("dialog", { name: "검침대장 출력" })).toBeInTheDocument();
  });

  it("상단 이벤트로 전체 이월 확인 상태를 열고 취소한다", () => {
    render(<UtilitiesPage />);
    act(() => window.dispatchEvent(new CustomEvent("utilities:carry-over")));
    expect(screen.getByRole("dialog")).toHaveTextContent("2026년 7월분 이월을 진행할까요?");
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByText("2026년 7월분 이월을 진행할까요?")).not.toBeInTheDocument();
  });

  it("전체 이월 확인 시 전월값을 수정 입력으로 준비한다", () => {
    render(<UtilitiesPage />);
    selectBuilding();
    act(() => window.dispatchEvent(new CustomEvent("utilities:carry-over")));
    fireEvent.click(screen.getByRole("button", { name: "이월" }));
    expect(screen.getByLabelText("101호 당월 지침값")).toHaveValue(472);
    expect(toast.success).toHaveBeenCalledWith("1개 호실의 이월값을 준비했습니다.");
  });
});
