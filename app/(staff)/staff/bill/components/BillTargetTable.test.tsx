import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BillingColumn, BillingUnitRow } from "@/lib/billing/pivot";
import { BillTargetTable } from "./BillTargetTable";

const columns: BillingColumn[] = [
  {
    feeItemId: 10,
    name: "관리비",
    carryOver: false,
    dailyProration: false,
    rounding: "raw",
    isRequired: true,
    sortOrder: 0,
  },
];

const unit: BillingUnitRow = {
  unitId: 1,
  unitNo: "101",
  dong: null,
  roomTypeLabel: null,
  occupancyId: 5,
  tenantName: "홍길동",
  moveInDate: "2026-07-01",
  isVacant: false,
  confirmedAt: "2026-08-13T00:00:00Z",
  confirmedByName: "관리자",
  totalAmount: 30_000,
  billingNote: null,
  unitNotice: null,
  isDirty: false,
  charges: { 10: { charged: true, amount: 30_000 } },
};

const defaultProps = {
  units: [unit],
  columns,
  period: "2026-08-01",
  labelMode: "name" as const,
  selected: new Set<number>(),
  onToggle: vi.fn(),
  onToggleAll: vi.fn(),
};

describe("BillTargetTable", () => {
  it("세대 행과 합계 및 입주자명을 표시한다", () => {
    render(<BillTargetTable {...defaultProps} />);

    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("30,000")).toBeInTheDocument();
  });

  it("labelMode이 code이면 입주자 표시 열에 호실 코드를 표시한다", () => {
    render(<BillTargetTable {...defaultProps} labelMode="code" />);

    expect(screen.getAllByText("101")).toHaveLength(2);
    expect(screen.queryByText("홍길동")).not.toBeInTheDocument();
  });

  it("개별 체크박스를 클릭하면 해당 unitId를 전달한다", () => {
    const onToggle = vi.fn();
    render(<BillTargetTable {...defaultProps} onToggle={onToggle} />);

    fireEvent.click(screen.getByLabelText("101 선택"));

    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("전체 선택 체크박스를 클릭하면 변경된 체크 상태를 전달한다", () => {
    const onToggleAll = vi.fn();
    render(<BillTargetTable {...defaultProps} onToggleAll={onToggleAll} />);

    fireEvent.click(screen.getByLabelText("전체 선택"));

    expect(onToggleAll).toHaveBeenCalledWith(true);
  });

  it("서버 합계가 없으면 실제 ChargeLine 형식으로 합계를 계산한다", () => {
    render(
      <BillTargetTable
        {...defaultProps}
        units={[{ ...unit, totalAmount: null, charges: { 10: { charged: true, amount: 12_345 } } }]}
      />,
    );

    expect(screen.getByText("12,345")).toBeInTheDocument();
  });

  it("모든 세대가 선택된 경우 전체 선택 체크박스를 체크한다", () => {
    render(<BillTargetTable {...defaultProps} selected={new Set([1])} />);

    expect(screen.getByLabelText("전체 선택")).toBeChecked();
  });
});
