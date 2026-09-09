// app/(staff)/staff/management-fee/components/BillingTable.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillingTable } from "./BillingTable";
import type { BillingUnitRow, BillingColumn } from "@/lib/billing/pivot";

const columns: BillingColumn[] = [
  { feeItemId: 10, name: "관리비", carryOver: true, dailyProration: false, rounding: "round", isRequired: true, sortOrder: 0 },
  { feeItemId: 11, name: "수도", carryOver: false, dailyProration: true, rounding: "round", isRequired: false, sortOrder: 1 },
];
const unit = (o: Partial<BillingUnitRow> = {}): BillingUnitRow => ({
  unitId: 1, unitNo: "101", dong: null, roomTypeLabel: "원룸", occupancyId: 5, tenantName: "홍길동",
  moveInDate: "2026-08-01", isVacant: false, confirmedAt: null, confirmedByName: null, totalAmount: null,
  billingNote: null, unitNotice: null, isDirty: false,
  charges: { 10: { charged: true, amount: 30000 }, 11: { charged: true, amount: 5000 } }, ...o,
});

describe("BillingTable", () => {
  it("항목 컬럼과 세대 행을 렌더", () => {
    render(<BillingTable units={[unit()]} columns={columns} period="2026-08-01"
      onChargeChange={vi.fn()} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    expect(screen.getAllByText("관리비").length).toBeGreaterThan(0);
    expect(screen.getByText("수도")).toBeInTheDocument();
    expect(screen.getByText("101")).toBeInTheDocument();
  });
  it("합계=charged 금액 합(비일할, 당월 전체 거주)", () => {
    render(<BillingTable units={[unit({ moveInDate: "2026-07-01" })]} columns={columns} period="2026-08-01"
      onChargeChange={vi.fn()} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    // 총 관리비 셀은 2줄(총 관리비 / 고정 관리비). 공과금 미전달 → 둘 다 30000+5000=35,000.
    expect(screen.getAllByText("35,000").length).toBeGreaterThan(0);
  });
  it("금액 입력 시 onChargeChange 호출", () => {
    const onChargeChange = vi.fn();
    render(<BillingTable units={[unit()]} columns={columns} period="2026-08-01"
      onChargeChange={onChargeChange} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    const input = screen.getByLabelText("101 관리비 금액");
    fireEvent.change(input, { target: { value: "40000" } });
    expect(onChargeChange).toHaveBeenCalledWith(1, 10, { amount: 40000 });
  });
  it("부과 체크 해제 시 onChargeChange(charged:false)", () => {
    const onChargeChange = vi.fn();
    render(<BillingTable units={[unit()]} columns={columns} period="2026-08-01"
      onChargeChange={onChargeChange} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("101 관리비 부과"));
    expect(onChargeChange).toHaveBeenCalledWith(1, 10, { charged: false });
  });
  it("공실 세대는 입력 비활성·합계 0", () => {
    render(<BillingTable units={[unit({ isVacant: true, tenantName: null })]} columns={columns} period="2026-08-01"
      onChargeChange={vi.fn()} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    expect(screen.getByLabelText("101 관리비 금액")).toBeDisabled();
    // 원본 정본: 공실 성명은 "-"로 표시(별도 "공실" 라벨 없음), 총 관리비 0.
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });
  it("확정 세대는 확정 배지, is_dirty면 재확정 필요", () => {
    render(<BillingTable units={[unit({ confirmedAt: "2026-08-13T00:00:00Z", isDirty: true })]} columns={columns} period="2026-08-01"
      onChargeChange={vi.fn()} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    expect(screen.getByText("재확정 필요")).toBeInTheDocument();
  });
  it("확정·non-dirty 세대는 charges 재계산 아닌 totalAmount 스냅샷을 합계로 표시", () => {
    // charges 합계는 30000+5000=35000 이지만 totalAmount=99000(스냅샷)이 표시되어야 한다
    const confirmedUnit = unit({
      confirmedAt: "2026-08-13T00:00:00Z",
      isDirty: false,
      totalAmount: 99000,
      charges: { 10: { charged: true, amount: 30000 }, 11: { charged: true, amount: 5000 } },
    });
    render(<BillingTable units={[confirmedUnit]} columns={columns} period="2026-08-01"
      onChargeChange={vi.fn()} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    // 확정·비수정 → 스냅샷 99,000 사용(공과금 미전달). 재계산값 35,000은 나오지 않아야 한다.
    expect(screen.getAllByText("99,000").length).toBeGreaterThan(0);
    expect(screen.queryByText("35,000")).not.toBeInTheDocument();
  });
});
