import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/utilities", () => ({
  useUtilityPrices: vi.fn(),
}));

import {
  useUtilityPrices,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import {
  GasSummaryTable,
  UNASSIGNED_GAS_LINE,
} from "./GasSummaryTable";

const baseRow: UtilityUnitRow = {
  unitId: 1,
  unitNo: "101호",
  dong: null,
  occupancyId: 10,
  tenantName: "홍길동",
  occupancyStatus: "occupied",
  moveInDate: null,
  customerNumber: "G-100",
  meterNumber: "M-1",
  previousReading: 10,
  currentReading: 15,
  usage: 5,
  unitPrice: 100,
  resolvedUnitPrice: 100,
  automaticCharge: 500,
  manualCharge: null,
  note: null,
  processedAt: null,
  discountType: null,
  discountAmount: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUtilityPrices).mockReturnValue({
    data: [{
      customerNumberId: 3,
      customerNo: "G-100",
      holderName: "김예금",
      sortOrder: 0,
      unitPrice: 100,
    }],
    isLoading: false,
    error: null,
  } as never);
});

describe("GasSummaryTable", () => {
  it("고객번호별 세대·사용량·우선 요금을 합산하고 미지정 라인을 제공한다", () => {
    const onLineChange = vi.fn();
    const rows = [
      baseRow,
      {
        ...baseRow,
        unitId: 2,
        unitNo: "102호",
        usage: 3,
        automaticCharge: 300,
        manualCharge: 450,
      },
      {
        ...baseRow,
        unitId: 3,
        unitNo: "201호",
        customerNumber: null,
        usage: null,
        automaticCharge: null,
      },
    ];
    render(
      <GasSummaryTable
        buildingId={4}
        rows={rows}
        selectedLine=""
        onLineChange={onLineChange}
      />,
    );

    expect(useUtilityPrices).toHaveBeenCalledWith(4, "gas");
    const gasLine = screen.getByText("G-100").closest("tr");
    expect(gasLine).not.toBeNull();
    expect(within(gasLine as HTMLElement).getByText("예금주 김예금")).toBeInTheDocument();
    expect(gasLine).toHaveTextContent("2세대");
    expect(gasLine).toHaveTextContent("8");
    expect(gasLine).toHaveTextContent("950원");

    fireEvent.change(screen.getByLabelText("라인 필터"), {
      target: { value: UNASSIGNED_GAS_LINE },
    });
    expect(onLineChange).toHaveBeenCalledWith(UNASSIGNED_GAS_LINE);
  });
});
