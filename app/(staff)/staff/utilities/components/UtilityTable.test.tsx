import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UtilityTable, type UtilityTableRow } from "./UtilityTable";

const fixedRow: UtilityTableRow = {
  unitId: 101,
  unitNo: "101호",
  dong: null,
  occupancyId: 1,
  tenantName: "김고정",
  occupancyStatus: "occupied",
  moveInDate: null,
  customerNumber: "W-101",
  meterNumber: null,
  previousReading: 100,
  currentReading: null,
  usage: null,
  unitPrice: 850,
  resolvedUnitPrice: 850,
  automaticCharge: null,
  manualCharge: null,
  note: null,
  processedAt: null,
  discountType: null,
  discountAmount: null,
  fixedUsage: 12.5,
};

describe("UtilityTable", () => {
  it("Figma 수정 상태의 전월·금월·량·수동입력·적요를 모두 입력할 수 있다", () => {
    render(
      <UtilityTable
        rows={[fixedRow]}
        drafts={{ 101: { previousReading: "100", currentReading: "158", usage: "12.5", manualCharge: "", note: "" } }}
        referenceDate="2026-08-14"
        onDraftChange={vi.fn()}
        onRowClick={vi.fn()}
        onFixedUsageClick={vi.fn()}
      />,
    );

    expect(screen.getByText("고정")).toBeInTheDocument();
    expect(screen.getByText("12.5")).toBeInTheDocument();
    expect(screen.getByLabelText("101호 전월 지침값")).toBeEnabled();
    expect(screen.getByLabelText("101호 당월 지침값")).toBeEnabled();
    expect(screen.getByLabelText("101호 사용량")).toBeEnabled();
    expect(screen.getByLabelText("101호 사용량")).toHaveValue(12.5);
    expect(screen.getByLabelText("101호 수동 입력 요금")).toBeEnabled();
    expect(screen.getByLabelText("101호 적요")).toBeEnabled();
    expect(screen.getByLabelText("101호 고정 사용량 설정")).toBeInTheDocument();
  });

  it("조회 상태의 지침·사용량·요금 관련 0을 하이픈으로 표시한다", () => {
    const zeroRow: UtilityTableRow = {
      ...fixedRow,
      unitId: 102,
      unitNo: "102호",
      previousReading: 0,
      currentReading: 0,
      usage: 0,
      fixedUsage: 0,
      unitPrice: 0,
      resolvedUnitPrice: 0,
      automaticCharge: 0,
      manualCharge: 0,
    };

    render(
      <UtilityTable
        rows={[zeroRow]}
        drafts={{ 102: { previousReading: "0", currentReading: "0", usage: "0", manualCharge: "0", note: "" } }}
        referenceDate="2026-08-14"
        editing={false}
        onDraftChange={vi.fn()}
        onRowClick={vi.fn()}
      />,
    );

    const cells = within(screen.getByText("102호").closest("tr") as HTMLElement).getAllByRole("cell");
    for (const columnIndex of [5, 6, 7, 8, 9, 10, 11]) {
      expect(cells[columnIndex].textContent).toBe("-");
    }
  });

  it("수정 상태의 0 입력은 하이픈으로 보이고 포커스하면 원래 값을 유지한다", () => {
    const zeroRow: UtilityTableRow = {
      ...fixedRow,
      unitId: 103,
      unitNo: "103호",
      previousReading: 0,
      currentReading: 0,
      usage: 0,
      fixedUsage: 0,
      manualCharge: 0,
    };

    render(
      <UtilityTable
        rows={[zeroRow]}
        drafts={{ 103: { previousReading: "0", currentReading: "0", usage: "0", manualCharge: "0", note: "" } }}
        referenceDate="2026-08-14"
        onDraftChange={vi.fn()}
        onRowClick={vi.fn()}
      />,
    );

    const previousInput = screen.getByLabelText("103호 전월 지침값");
    expect(previousInput).toHaveValue(null);
    expect(previousInput).toHaveAttribute("placeholder", "-");
    fireEvent.focus(previousInput);
    expect(previousInput).toHaveValue(0);
  });
});
