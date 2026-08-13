import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingFlatRow } from "@/lib/billing/pivot";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/billing", () => ({ useBilling: vi.fn() }));

import BillPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBilling } from "@/hooks/reactquery/billing";

const baseRow: BillingFlatRow = {
  unitId: 1,
  unitNo: "101",
  dong: null,
  roomTypeLabel: null,
  occupancyId: 5,
  tenantName: "홍길동",
  moveInDate: "2026-07-01",
  isVacant: false,
  feeItemId: 10,
  feeItemName: "관리비",
  carryOver: false,
  dailyProration: false,
  rounding: "raw",
  isRequired: true,
  sortOrder: 0,
  charged: true,
  amount: 30_000,
  confirmedAt: "2026-08-13T00:00:00Z",
  confirmedByName: "관리자",
  totalAmount: 30_000,
  billingNote: null,
  unitNotice: null,
  isDirty: false,
};

function billingRow(overrides: Partial<BillingFlatRow> = {}): BillingFlatRow {
  return { ...baseRow, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMe).mockReturnValue({
    data: { orgId: 10, role: "org_owner", permissions: [] },
  } as never);
  vi.mocked(useBuildings).mockReturnValue({
    data: [
      { id: 7, name: "가나빌", typeId: 1 },
      { id: 8, name: "다라빌", typeId: 2 },
    ],
    isLoading: false,
  } as never);
  vi.mocked(useBilling).mockReturnValue({ data: [], isLoading: false, error: null } as never);
});

describe("bill page", () => {
  it("bill_publish 권한이 없으면 접근을 차단한다", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { orgId: 10, role: "staff", permissions: [] },
    } as never);

    render(<BillPage />);

    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
  });

  it("권한이 있고 건물을 선택하지 않았으면 선택 안내를 표시한다", () => {
    render(<BillPage />);

    expect(screen.getByLabelText("건물 선택")).toBeInTheDocument();
    expect(screen.getByText("건물을 선택해 주세요.", { selector: "p" })).toBeInTheDocument();
  });

  it("건물을 선택했지만 부과 확정 세대가 없으면 미확정 안내를 표시한다", () => {
    vi.mocked(useBilling).mockReturnValue({
      data: [billingRow({ confirmedAt: null, confirmedByName: null, totalAmount: null })],
      isLoading: false,
      error: null,
    } as never);

    render(<BillPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });

    expect(screen.getByText(/부과 확정된 세대가 없습니다/)).toBeInTheDocument();
  });

  it("확정되었고 공실이 아닌 세대만 발행 대상 목록에 표시한다", () => {
    vi.mocked(useBilling).mockReturnValue({
      data: [
        billingRow(),
        billingRow({ unitId: 2, unitNo: "102", tenantName: "미확정", confirmedAt: null }),
        billingRow({ unitId: 3, unitNo: "103", tenantName: "공실", isVacant: true }),
      ],
      isLoading: false,
      error: null,
    } as never);

    render(<BillPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });

    expect(screen.getByLabelText("101 선택")).toBeInTheDocument();
    expect(screen.queryByLabelText("102 선택")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("103 선택")).not.toBeInTheDocument();
  });

  it("건물이나 부과월을 변경하면 세대 선택을 초기화한다", () => {
    vi.mocked(useBilling).mockReturnValue({
      data: [billingRow()],
      isLoading: false,
      error: null,
    } as never);

    render(<BillPage />);
    const buildingSelect = screen.getByLabelText("건물 선택");
    fireEvent.change(buildingSelect, { target: { value: "7" } });
    fireEvent.click(screen.getByLabelText("101 선택"));
    expect(screen.getByLabelText("101 선택")).toBeChecked();

    fireEvent.change(buildingSelect, { target: { value: "8" } });
    expect(screen.getByLabelText("101 선택")).not.toBeChecked();

    fireEvent.click(screen.getByLabelText("101 선택"));
    fireEvent.change(screen.getByLabelText("부과월"), { target: { value: "2026-07" } });
    expect(screen.getByLabelText("101 선택")).not.toBeChecked();
  });
});
