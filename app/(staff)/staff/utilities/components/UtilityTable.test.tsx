import { render, screen } from "@testing-library/react";
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
  it("고정 사용량 세대는 고정 배지·사용량을 표시하고 당월 지침 입력을 비활성화한다", () => {
    render(
      <UtilityTable
        rows={[fixedRow]}
        drafts={{ 101: { currentReading: "158", manualCharge: "", note: "" } }}
        referenceDate="2026-08-14"
        onDraftChange={vi.fn()}
        onRowClick={vi.fn()}
        onFixedUsageClick={vi.fn()}
      />,
    );

    expect(screen.getByText("고정")).toBeInTheDocument();
    expect(screen.getByText("12.5")).toBeInTheDocument();
    expect(screen.getByLabelText("101호 당월 지침값")).toBeDisabled();
    expect(screen.getByLabelText("101호 고정 사용량 설정")).toBeInTheDocument();
  });
});
