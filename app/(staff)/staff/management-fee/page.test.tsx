// app/(staff)/staff/management-fee/page.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/buildingTypes", () => ({
  useBuildingTypes: vi.fn(() => ({ data: [{ id: 1, orgId: 10, label: "원룸텔", sortOrder: 0 }] })),
  useCreateBuildingType: vi.fn(), useRenameBuildingType: vi.fn(), useDeleteBuildingType: vi.fn(),
}));
vi.mock("@/hooks/reactquery/feeItems", () => ({
  useFeeItems: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateFeeItem: vi.fn(() => mut), useUpdateFeeItem: vi.fn(() => mut),
  useDeleteFeeItem: vi.fn(() => mut), useReorderFeeItems: vi.fn(() => mut),
}));
vi.mock("@/hooks/reactquery/billing", () => ({
  useBilling: vi.fn(), useSaveBillingCharges: vi.fn(() => mut), useConfirmBilling: vi.fn(() => mut),
  useUnchargedNewOccupancies: vi.fn(), useChargeNewOccupancies: vi.fn(() => mut),
  useBillingHistory: vi.fn(() => ({ data: [], isLoading: false })),
  useBillingPeriodSetting: vi.fn(), useSaveBillingPeriodSetting: vi.fn(() => periodMut),
  defaultBillingPeriodSetting: vi.fn((buildingId: number, period: string) => ({
    buildingId, period, chargeStartDate: "2026-07-16", chargeEndDate: "2026-08-15",
    dueDate: null, isSaved: false,
  })),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const mut = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
const periodMut = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
import FeeItemPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useBilling,
  useSaveBillingCharges,
  useConfirmBilling,
  useBillingPeriodSetting,
  useSaveBillingPeriodSetting,
  useUnchargedNewOccupancies,
  useChargeNewOccupancies,
} from "@/hooks/reactquery/billing";

beforeEach(() => {
  vi.clearAllMocks();
  mut.mutateAsync.mockResolvedValue({});
  periodMut.mutateAsync.mockResolvedValue({});
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 10, role: "org_owner", permissions: [] } } as never);
  vi.mocked(useBuildings).mockReturnValue({ data: [{ id: 7, name: "가나빌", typeId: 1 }], isLoading: false } as never);
  vi.mocked(useBilling).mockReturnValue({ data: [], isLoading: false, error: null } as never);
  vi.mocked(useSaveBillingCharges).mockReturnValue(mut as never);
  vi.mocked(useConfirmBilling).mockReturnValue(mut as never);
  vi.mocked(useBillingPeriodSetting).mockReturnValue({
    data: {
      buildingId: 7, period: "2026-08-01", chargeStartDate: "2026-07-16",
      chargeEndDate: "2026-08-15", dueDate: null, isSaved: false,
    },
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useSaveBillingPeriodSetting).mockReturnValue(periodMut as never);
  vi.mocked(useUnchargedNewOccupancies).mockReturnValue({ data: [], isLoading: false } as never);
  vi.mocked(useChargeNewOccupancies).mockReturnValue(mut as never);
});

describe("management-fee page (billing)", () => {
  it("billing 권한 없으면 접근 차단", () => {
    vi.mocked(useMe).mockReturnValue({ data: { orgId: 10, role: "staff", permissions: [] } } as never);
    render(<FeeItemPage />);
    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
  });
  it("건물 미선택 시 안내", () => {
    render(<FeeItemPage />);
    expect(screen.getByText(/건물을 선택/)).toBeInTheDocument();
  });
  it("건물 선택 드롭다운과 항목관리·저장 버튼", () => {
    render(<FeeItemPage />);
    expect(screen.getByLabelText("건물 선택")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "항목관리" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });
  it("부과 확정 클릭 시 확인 후 confirmBilling 호출", async () => {
    const confirmMut = { mutateAsync: vi.fn().mockResolvedValue({ unitCount: 2, total: 60000 }), isPending: false };
    vi.mocked(useConfirmBilling).mockReturnValue(confirmMut as never);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(useBilling).mockReturnValue({ data: [{
      unitId: 1, unitNo: "101", dong: null, roomTypeLabel: "원룸", occupancyId: 5, tenantName: "홍",
      moveInDate: "2026-07-01", isVacant: false, feeItemId: 10, feeItemName: "관리비",
      carryOver: false, dailyProration: false, rounding: "round", isRequired: true, sortOrder: 0,
      charged: true, amount: 30000, confirmedAt: null, confirmedByName: null, totalAmount: null,
      billingNote: null, unitNotice: null, isDirty: false,
    }], isLoading: false, error: null } as never);
    render(<FeeItemPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "부과 확정" }));
    await waitFor(() => expect(confirmMut.mutateAsync).toHaveBeenCalledWith({ buildingId: 7, period: expect.any(String) }));
  });

  it("건물 선택 시 세대 그리드 로드(useBilling)", async () => {
    vi.mocked(useBilling).mockReturnValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, room_type_label: "원룸", occupancy_id: 5, tenant_name: "홍",
      move_in_date: "2026-07-01", is_vacant: false, fee_item_id: 10, fee_item_name: "관리비",
      carry_over: false, daily_proration: false, rounding: "round", is_required: true, sort_order: 0,
      charged: true, amount: 30000, confirmed_at: null, confirmed_by_name: null, total_amount: null,
      billing_note: null, unit_notice: null, is_dirty: false,
    }].map(camel), isLoading: false, error: null } as never);
    render(<FeeItemPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    await waitFor(() => expect(screen.getByText("101")).toBeInTheDocument());
  });

  it("건물·월분의 기본 부과기준일을 표시하고 수정한 납기일을 저장", async () => {
    render(<FeeItemPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });

    const schedule = screen.getByRole("group", { name: "부과 일정 설정" });
    expect(within(schedule).getByLabelText("부과기준일 시작일")).toHaveValue("2026-07-16");
    expect(within(schedule).getByLabelText("부과기준일 종료일")).toHaveValue("2026-08-15");

    fireEvent.click(within(schedule).getByRole("button", { name: "수정" }));
    fireEvent.change(within(schedule).getByLabelText("납기일"), { target: { value: "2026-08-25" } });
    fireEvent.click(within(schedule).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(periodMut.mutateAsync).toHaveBeenCalledWith({
      buildingId: 7,
      period: expect.stringMatching(/^\d{4}-\d{2}-01$/),
      chargeStartDate: "2026-07-16",
      chargeEndDate: "2026-08-15",
      dueDate: "2026-08-25",
    }));
  });

  it("§3.3 감지 결과 있으면 신규입주 당월부과 팝업 자동 오픈", async () => {
    vi.mocked(useUnchargedNewOccupancies).mockReturnValue({ data: [
      { unitId: 3, unitNo: "301", dong: "A", tenantName: "김신규", moveInDate: "2026-08-20" },
    ], isLoading: false } as never);
    render(<FeeItemPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    await waitFor(() => expect(screen.getByText("이번 달 관리비를 부과하시겠습니까?")).toBeInTheDocument());
  });

  it("§3.3 팝업 확인 시 chargeNewOccupancies 호출(체크 세대)", async () => {
    const chargeMut = { mutateAsync: vi.fn().mockResolvedValue({ unitCount: 1, total: 30000 }), isPending: false };
    vi.mocked(useChargeNewOccupancies).mockReturnValue(chargeMut as never);
    vi.mocked(useUnchargedNewOccupancies).mockReturnValue({ data: [
      { unitId: 3, unitNo: "301", dong: "A", tenantName: "김신규", moveInDate: "2026-08-20" },
    ], isLoading: false } as never);
    render(<FeeItemPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    await screen.findByText("이번 달 관리비를 부과하시겠습니까?");
    fireEvent.click(screen.getByRole("button", { name: "부과" }));
    await waitFor(() => expect(chargeMut.mutateAsync).toHaveBeenCalledWith({
      buildingId: 7, period: expect.stringMatching(/^\d{4}-\d{2}-01$/), unitIds: [3],
    }));
  });

  it("§3.4 셋팅확인 건물 선택 시 window.confirm 취소하면 미로드", () => {
    vi.mocked(useBuildings).mockReturnValue({
      data: [{ id: 7, name: "가나빌", typeId: 1, setupConfirmRequired: true }], isLoading: false,
    } as never);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<FeeItemPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText(/건물을 선택/)).toBeInTheDocument();
  });

  it("§3.4 셋팅확인 건물 선택 확인하면 로드", async () => {
    vi.mocked(useBuildings).mockReturnValue({
      data: [{ id: 7, name: "가나빌", typeId: 1, setupConfirmRequired: true }], isLoading: false,
    } as never);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(useBilling).mockReturnValue({ data: [{
      unitId: 1, unitNo: "101", dong: null, roomTypeLabel: "원룸", occupancyId: 5, tenantName: "홍",
      moveInDate: "2026-07-01", isVacant: false, feeItemId: 10, feeItemName: "관리비",
      carryOver: false, dailyProration: false, rounding: "round", isRequired: true, sortOrder: 0,
      charged: true, amount: 30000, confirmedAt: null, confirmedByName: null, totalAmount: null,
      billingNote: null, unitNotice: null, isDirty: false,
    }], isLoading: false, error: null } as never);
    render(<FeeItemPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    await waitFor(() => expect(screen.getByText("101")).toBeInTheDocument());
  });
});

// useBilling은 이미 camelCase(BillingFlatRow)를 반환하므로 테스트 헬퍼로 매핑
function camel(r: Record<string, unknown>) {
  return {
    unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, roomTypeLabel: r.room_type_label,
    occupancyId: r.occupancy_id, tenantName: r.tenant_name, moveInDate: r.move_in_date, isVacant: r.is_vacant,
    feeItemId: r.fee_item_id, feeItemName: r.fee_item_name, carryOver: r.carry_over, dailyProration: r.daily_proration,
    rounding: r.rounding, isRequired: r.is_required, sortOrder: r.sort_order, charged: r.charged, amount: r.amount,
    confirmedAt: r.confirmed_at, confirmedByName: r.confirmed_by_name, totalAmount: r.total_amount,
    billingNote: r.billing_note, unitNotice: r.unit_notice, isDirty: r.is_dirty,
  };
}
