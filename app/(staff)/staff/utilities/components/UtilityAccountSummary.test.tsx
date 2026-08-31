import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { UtilityAccountSummary } from "./UtilityAccountSummary";

const zeroPriceRow: UtilityUnitRow = {
  unitId: 1,
  unitNo: "101호",
  dong: null,
  occupancyId: 1,
  tenantName: "김수도",
  occupancyStatus: "occupied",
  moveInDate: null,
  customerNumber: "W-100",
  meterNumber: null,
  previousReading: 0,
  currentReading: 0,
  usage: 0,
  unitPrice: 0,
  resolvedUnitPrice: 0,
  automaticCharge: 0,
  manualCharge: 0,
  note: null,
  processedAt: null,
  discountType: null,
  discountAmount: 0,
};

describe("UtilityAccountSummary", () => {
  it("상단 그리드의 단가 0을 하이픈으로 표시한다", () => {
    render(
      <UtilityAccountSummary
        rows={[zeroPriceRow]}
        selectedRow={zeroPriceRow}
        editing={false}
        onSelect={vi.fn()}
      />,
    );

    const cells = within(screen.getByText("W-100").closest("tr") as HTMLElement).getAllByRole("cell");
    expect(cells[9]).toHaveTextContent("-");
  });
});
