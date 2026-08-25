import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  params: { token: "66666666-7777-4888-8999-000000000000" },
}));
const settlement = vi.hoisted(() => ({
  usePublicSettlementByToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => nav.params }));
vi.mock("@/hooks/reactquery/residentSettlement", () => settlement);

import PublicSettlementPage from "./page";

const publicSettlement = {
  moveOutDate: "2026-08-25",
  settlementKind: "추가납부",
  settlementAmount: 218806,
  unitLabel: "101동 201호",
  buildingName: "그린빌라",
  isExpired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  settlement.usePublicSettlementByToken.mockReturnValue({
    data: publicSettlement,
    error: null,
    isPending: false,
    refetch: vi.fn(),
  });
});

describe("PublicSettlementPage", () => {
  it("shows pending and retryable error states", () => {
    const refetch = vi.fn();
    settlement.usePublicSettlementByToken
      .mockReturnValueOnce({
        data: undefined,
        error: null,
        isPending: true,
        refetch,
      })
      .mockReturnValueOnce({
        data: undefined,
        error: new Error("failed"),
        isPending: false,
        refetch,
      });

    const view = render(<PublicSettlementPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "이사정산 내역을 불러오고 있어요.",
    );

    view.rerender(<PublicSettlementPage />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows invalid and expired links without masked amounts", () => {
    settlement.usePublicSettlementByToken
      .mockReturnValueOnce({
        data: null,
        error: null,
        isPending: false,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        data: {
          moveOutDate: null,
          settlementKind: null,
          settlementAmount: null,
          unitLabel: null,
          buildingName: null,
          isExpired: true,
        },
        error: null,
        isPending: false,
        refetch: vi.fn(),
      });

    const view = render(<PublicSettlementPage />);
    expect(screen.getByText("유효하지 않은 링크예요.")).toBeInTheDocument();

    view.rerender(<PublicSettlementPage />);
    expect(screen.getByText("만료된 링크예요.")).toBeInTheDocument();
    expect(screen.queryByText("218,806원")).not.toBeInTheDocument();
  });

  it("renders the whitelisted settlement detail", () => {
    render(<PublicSettlementPage />);

    expect(settlement.usePublicSettlementByToken).toHaveBeenCalledWith(
      "66666666-7777-4888-8999-000000000000",
    );
    expect(screen.getByText("그린빌라 · 101동 201호")).toBeInTheDocument();
    expect(screen.getByText("2026.08.25")).toBeInTheDocument();
    expect(screen.getByText("추가납부")).toBeInTheDocument();
    expect(screen.getByText("218,806원")).toBeInTheDocument();
    expect(screen.queryByText(/010-/)).not.toBeInTheDocument();
  });
});
