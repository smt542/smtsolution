import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutation = () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
const saveMut = mutation();
const confirmMut = { mutateAsync: vi.fn().mockResolvedValue({ unitCount: 1, total: 30000 }), isPending: false };
const copyMut = { mutateAsync: vi.fn().mockResolvedValue({ buildingCount: 1, unitCount: 1, chargeCount: 1 }), isPending: false };
const periodMut = mutation();
const noteMut = mutation();
const chargeNewMut = mutation();

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildings: vi.fn(),
  useSetBuildingSetupConfirm: vi.fn(() => mutation()),
}));
vi.mock("@/hooks/reactquery/buildingTypes", () => ({
  useBuildingTypes: vi.fn(() => ({ data: [{ id: 1, orgId: 10, label: "원룸텔", sortOrder: 0 }] })),
}));
vi.mock("@/hooks/reactquery/billing", () => ({
  useBilling: vi.fn(),
  useSaveBillingCharges: vi.fn(() => saveMut),
  useConfirmBilling: vi.fn(() => confirmMut),
  useCopyPreviousBilling: vi.fn(() => copyMut),
  useUnchargedNewOccupancies: vi.fn(),
  useChargeNewOccupancies: vi.fn(() => chargeNewMut),
  useBillingHistory: vi.fn(() => ({ data: [], isLoading: false })),
  useBillingPeriodSetting: vi.fn(),
  useSaveBillingPeriodSetting: vi.fn(() => periodMut),
  defaultBillingPeriodSetting: vi.fn((buildingId: number, period: string) => ({
    buildingId,
    period,
    chargeStartDate: "2026-07-16",
    chargeEndDate: "2026-08-15",
    dueDate: null,
    isSaved: false,
  })),
}));
vi.mock("@/hooks/reactquery/receipts", () => ({ useSaveBuildingNotes: vi.fn(() => noteMut) }));
vi.mock("@/hooks/reactquery/utilities", () => ({
  useUtilityRows: vi.fn(() => ({ data: [], isLoading: false })),
  useUtilityConfirmation: vi.fn(() => ({ data: null, isLoading: false })),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import ManagementFeePage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBilling, useBillingPeriodSetting, useUnchargedNewOccupancies } from "@/hooks/reactquery/billing";

const baseBuilding = {
  id: 7,
  orgId: 10,
  code: "B001",
  name: "가나빌",
  address: "서울시 강남구",
  typeId: 1,
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
};

const billingRow = {
  unitId: 1,
  unitNo: "101",
  dong: null,
  roomTypeLabel: "원룸",
  occupancyId: 5,
  tenantName: "홍길동",
  moveInDate: "2026-07-01",
  isVacant: false,
  feeItemId: 10,
  feeItemName: "관리비",
  carryOver: false,
  dailyProration: false,
  rounding: "round",
  isRequired: true,
  sortOrder: 0,
  charged: true,
  amount: 30000,
  confirmedAt: null,
  confirmedByName: null,
  totalAmount: null,
  billingNote: null,
  unitNotice: null,
  isDirty: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  confirmMut.mutateAsync.mockResolvedValue({ unitCount: 1, total: 30000 });
  copyMut.mutateAsync.mockResolvedValue({ buildingCount: 1, unitCount: 1, chargeCount: 1 });
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 10, role: "org_owner", permissions: [] } } as never);
  vi.mocked(useBuildings).mockReturnValue({ data: [baseBuilding], isLoading: false } as never);
  vi.mocked(useBilling).mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() } as never);
  vi.mocked(useBillingPeriodSetting).mockReturnValue({
    data: { buildingId: 7, period: "2026-08-01", chargeStartDate: "2026-07-16", chargeEndDate: "2026-08-15", dueDate: null, isSaved: true },
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useUnchargedNewOccupancies).mockReturnValue({ data: [], isLoading: false } as never);
});

describe("관리비 부과 셋팅", () => {
  it("billing 권한이 없으면 접근을 차단한다", () => {
    vi.mocked(useMe).mockReturnValue({ data: { orgId: 10, role: "staff", permissions: [] } } as never);
    render(<ManagementFeePage />);
    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
  });

  it("미선택 상태와 Figma 작업 버튼을 표시한다", () => {
    render(<ManagementFeePage />);
    expect(screen.getAllByText("건물을 선택해 주세요").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "빌라자료추가" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "전체자료추가" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "공과금 계산" })).toBeDisabled();
  });

  it("건물을 선택하면 세대 표를 표시한다", async () => {
    vi.mocked(useBilling).mockReturnValue({ data: [billingRow], isLoading: false, error: null, refetch: vi.fn() } as never);
    render(<ManagementFeePage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    expect(await screen.findByText("101")).toBeInTheDocument();
  });

  it("수정 후 저장하면 일정 저장과 부과 확정을 함께 수행한다", async () => {
    vi.mocked(useBilling).mockReturnValue({ data: [billingRow], isLoading: false, error: null, refetch: vi.fn() } as never);
    render(<ManagementFeePage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    const schedule = screen.getByRole("group", { name: "부과 일정 설정" });
    fireEvent.click(within(schedule).getByRole("button", { name: "수정" }));
    fireEvent.click(within(schedule).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(periodMut.mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(confirmMut.mutateAsync).toHaveBeenCalledWith({ buildingId: 7, period: expect.any(String) }));
  });

  it("부과기준일을 수정해 저장한다", async () => {
    render(<ManagementFeePage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    const schedule = screen.getByRole("group", { name: "부과 일정 설정" });
    fireEvent.click(within(schedule).getByRole("button", { name: "수정" }));
    fireEvent.change(within(schedule).getByLabelText("부과기준일 시작일"), { target: { value: "2026-07-20" } });
    fireEvent.click(within(schedule).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(periodMut.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ chargeStartDate: "2026-07-20" })));
  });

  it("공과금 미산정 시 안내 모달을 표시한다", () => {
    render(<ManagementFeePage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "공과금 계산" }));
    expect(screen.getByRole("dialog", { name: "공과금 부과액이 아직 없어요" })).toBeInTheDocument();
  });

  it("전체 전월자료 반영을 확인한 뒤 복사한다", async () => {
    render(<ManagementFeePage />);
    fireEvent.click(screen.getByRole("button", { name: "전체자료추가" }));
    expect(screen.getByRole("dialog", { name: "전체 건물에 전월 자료를 반영할까요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "반영" }));
    await waitFor(() => expect(copyMut.mutateAsync).toHaveBeenCalledWith({ buildingIds: [7], period: expect.any(String) }));
  });

  it("중요 건물은 경고 후 개별 전월자료 반영을 재확인한다", async () => {
    vi.mocked(useBuildings).mockReturnValue({ data: [{ ...baseBuilding, setupConfirmRequired: true }], isLoading: false } as never);
    render(<ManagementFeePage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "빌라자료추가" }));
    expect(screen.getByRole("dialog", { name: "중요 건물로 지정된 건물이에요" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(screen.getByRole("dialog", { name: "이 건물에 전월 자료를 반영할까요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "반영" }));
    await waitFor(() => expect(copyMut.mutateAsync).toHaveBeenCalledWith({ buildingIds: [7], period: expect.any(String) }));
  });

  it("신규 입주 감지 시 당월 부과 모달을 자동으로 연다", async () => {
    vi.mocked(useUnchargedNewOccupancies).mockReturnValue({ data: [{ unitId: 3, unitNo: "301", dong: "A", tenantName: "김신규", moveInDate: "2026-08-20" }], isLoading: false } as never);
    render(<ManagementFeePage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    expect(await screen.findByText("이번 달 관리비를 부과하시겠습니까?")).toBeInTheDocument();
  });
});
