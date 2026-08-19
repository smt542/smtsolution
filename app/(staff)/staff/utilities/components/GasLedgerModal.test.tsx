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
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { GasLedgerModal } from "./GasLedgerModal";

const row: UtilityUnitRow = {
  unitId: 1,
  unitNo: "101호",
  dong: null,
  occupancyId: 10,
  tenantName: "홍길동",
  occupancyStatus: "occupied",
  moveInDate: null,
  customerNumber: "G-1",
  meterNumber: null,
  previousReading: 20,
  currentReading: 20,
  usage: 0,
  unitPrice: 100,
  resolvedUnitPrice: 100,
  automaticCharge: 0,
  manualCharge: null,
  note: null,
  processedAt: null,
  discountType: null,
  discountAmount: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useQueries).mockImplementation(((options: {
    queries: { queryKey: unknown[] }[];
  }) => options.queries.map((query) => ({
    data: [{ ...row, unitId: query.queryKey[2] as number }],
    isLoading: false,
    error: null,
  }))) as never);
});

describe("GasLedgerModal", () => {
  it("현재 건물을 기본 선택하고 계량기 없음·워터마크를 출력하며 다중 건물을 선택한다", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <GasLedgerModal
        open
        buildings={[
          { id: 1, name: "그린빌라", address: "서울시" },
          { id: 2, name: "블루타워", address: "부산시" },
        ]}
        currentBuildingId={1}
        period="2026-08-01"
        onClose={() => {}}
      />,
    );

    expect(screen.getByLabelText("그린빌라")).toBeChecked();
    expect(screen.getByLabelText("블루타워")).not.toBeChecked();
    let ledger = screen.getByTestId("gas-ledger-print");
    expect(within(ledger).getByText("계량기 없음")).toBeInTheDocument();
    expect(within(ledger).getAllByText("관리비서").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText("블루타워"));
    ledger = screen.getByTestId("gas-ledger-print");
    expect(within(ledger).getByText(/블루타워 · 2026년 8월/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "인쇄" }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
