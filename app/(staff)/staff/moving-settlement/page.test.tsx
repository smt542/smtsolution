import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/units", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/reactquery/movingSettlement", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/hooks/reactquery/movingSettlement")
  >();
  return {
    ...actual,
    useSettlementContext: vi.fn(),
    useSaveSettlement: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteSettlement: () => ({ mutate: vi.fn(), isPending: false }),
    useMidMoveout: () => ({ mutate: vi.fn(), isPending: false }),
    useSettlementList: () => ({ data: [], isLoading: false, error: null }),
  };
});

import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useSettlementContext } from "@/hooks/reactquery/movingSettlement";
import { useUnits } from "@/hooks/reactquery/units";
import MovingSettlementPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMe).mockReturnValue({
    data: { role: "staff", permissions: ["moving"] },
  } as never);
  vi.mocked(useBuildings).mockReturnValue({
    data: [{ id: 3, name: "해오름" }],
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useUnits).mockReturnValue({
    data: [{ id: 101, unitNo: "101호", dong: "A동" }],
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useSettlementContext).mockReturnValue({
    data: {
      unit: { id: 101, unitNo: "101호", dong: "A동", buildingId: 3 },
      occupancy: {
        id: 9,
        tenantName: "홍길동",
        moveInDate: "2025-08-01",
        settlementNote: null,
        billingNote: null,
        status: "occupied",
      },
      latestSettlement: null,
      settleAccount: {
        settleBank: "한국은행",
        settleAcct: "123",
        settleHolder: "관리실",
      },
      checklist: [{ id: 7, label: "열쇠 반납", checked: false }],
      meterSummary: [
        { utility: "water", previousReading: 10, currentReading: 14, usage: 4 },
      ],
    },
    isLoading: false,
    error: null,
  } as never);
});

describe("MovingSettlementPage", () => {
  it("건물·호실 선택 뒤 context를 표시한다", async () => {
    render(<MovingSettlementPage />);

    expect(screen.getByRole("link", { name: "수도 조회" })).toHaveAttribute(
      "href",
      "/staff/moving-settlement/inquiries/water",
    );
    expect(screen.getByRole("link", { name: "전체 조회" })).toHaveAttribute(
      "href",
      "/staff/moving-settlement/inquiries/all",
    );

    fireEvent.change(screen.getByLabelText("건물 선택"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("호실 선택"), {
      target: { value: "101" },
    });

    expect(useSettlementContext).toHaveBeenLastCalledWith(101);
    await waitFor(() => {
      expect(screen.getByText("홍길동")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("정산 은행")).toHaveValue("한국은행");
    expect(screen.getByRole("checkbox", { name: "열쇠 반납" })).toBeInTheDocument();
  });
});
