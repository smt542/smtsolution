import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({ useQueries: vi.fn() }));
vi.mock("@/hooks/reactquery/utilities", () => ({
  listUtilityRows: vi.fn(),
  utilityKeys: {
    rows: (buildingId: number, utilityType: string, period: string) => [
      "utilities",
      "rows",
      buildingId,
      utilityType,
      period,
    ],
  },
}));

import { useQueries } from "@tanstack/react-query";
import type { Building } from "@/hooks/reactquery/buildings";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { MeterLedgerModal } from "./MeterLedgerModal";

const building = {
  id: 1,
  code: "001",
  name: "그린빌라",
  address: "서울 강서구 화곡로 12",
  entrancePassword: "1007#",
  ownerPhone: "010-1234-5678",
} as Building;

const row: UtilityUnitRow = {
  unitId: 101,
  unitNo: "101호",
  dong: null,
  occupancyId: 10,
  tenantName: "홍길동",
  occupancyStatus: "occupied",
  moveInDate: null,
  customerNumber: "W-101",
  meterNumber: "M-101",
  previousReading: 100,
  currentReading: 125,
  usage: 25,
  unitPrice: 850,
  resolvedUnitPrice: 850,
  automaticCharge: 21250,
  manualCharge: null,
  note: null,
  processedAt: null,
  discountType: "recipient",
  discountAmount: 2000,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useQueries).mockImplementation(((options: {
    queries: { queryKey: unknown[] }[];
  }) => options.queries.map(() => ({
    data: [row],
    isLoading: false,
    error: null,
  }))) as never);
});

describe("MeterLedgerModal", () => {
  it("수도 검침값을 Figma A4 대장의 수도 열에 표시하고 브라우저 인쇄를 실행한다", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const onPrinted = vi.fn();

    render(
      <MeterLedgerModal
        open
        buildings={[building]}
        currentBuildingId={building.id}
        period="2026-07-01"
        utilityType="water"
        onClose={() => {}}
        onPrinted={onPrinted}
      />,
    );

    const preview = screen.getByTestId("meter-ledger-preview");
    expect(within(preview).getByText("[ 2026 년 07 월분 검침대장 ]")).toBeInTheDocument();
    expect(within(preview).getByTestId("ledger-water-101-0")).toHaveTextContent("100");
    expect(within(preview).getByTestId("ledger-water-101-1")).toHaveTextContent("125");
    expect(within(preview).getByTestId("ledger-water-101-2")).toHaveTextContent("25");
    expect(within(preview).getByTestId("ledger-electricity-101-0")).toBeEmptyDOMElement();
    expect(within(preview).getByText("수급자 2,000원")).toBeInTheDocument();

    expect(vi.mocked(useQueries).mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      queries: [expect.objectContaining({
        queryKey: ["utilities", "rows", 1, "water", "2026-07-01"],
      })],
    }));

    fireEvent.click(screen.getByRole("button", { name: "인쇄" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(onPrinted).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it("12개 호실마다 A4 페이지를 나눈다", () => {
    vi.mocked(useQueries).mockReturnValue([{
      data: Array.from({ length: 13 }, (_, index) => ({
        ...row,
        unitId: index + 1,
        unitNo: `${index + 1}01호`,
      })),
      isLoading: false,
      error: null,
    }] as never);

    render(
      <MeterLedgerModal
        open
        buildings={[building]}
        currentBuildingId={building.id}
        period="2026-07-01"
        utilityType="water"
        onClose={() => {}}
      />,
    );

    expect(within(screen.getByTestId("meter-ledger-preview")).getAllByText(/그린빌라 · [12] \/ 2/)).toHaveLength(2);
  });
});
