import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicSettlementByToken: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./data", () => ({
  getPublicSettlementByToken: mocks.getPublicSettlementByToken,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import PublicSettlementLoading from "./loading";
import PublicSettlementPage from "./page";

const token = "66666666-7777-4888-8999-000000000000";
const publicSettlement = {
  moveOutDate: "2026-08-25",
  settlementKind: "추가납부" as const,
  settlementAmount: 218806,
  unitLabel: "101동 201호",
  buildingName: "그린빌라",
  isExpired: false,
};

const renderPage = async () =>
  render(<>{await PublicSettlementPage({ params: Promise.resolve({ token }) })}</>);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublicSettlementByToken.mockResolvedValue(publicSettlement);
});

describe("PublicSettlementPage", () => {
  it("shows the route loading state and refreshes a failed server request", async () => {
    const loading = render(<PublicSettlementLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "이사정산 내역을 불러오고 있어요.",
    );
    loading.unmount();

    mocks.getPublicSettlementByToken.mockRejectedValue(new Error("failed"));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("shows invalid and expired links without masked amounts", async () => {
    mocks.getPublicSettlementByToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        moveOutDate: null,
        settlementKind: null,
        settlementAmount: null,
        unitLabel: null,
        buildingName: null,
        isExpired: true,
      });

    const view = await renderPage();
    expect(screen.getByText("유효하지 않은 링크예요.")).toBeInTheDocument();

    view.rerender(
      <>
        {await PublicSettlementPage({ params: Promise.resolve({ token }) })}
      </>,
    );
    expect(screen.getByText("만료된 링크예요.")).toBeInTheDocument();
    expect(screen.queryByText("218,806원")).not.toBeInTheDocument();
  });

  it("renders the server-fetched whitelisted settlement detail", async () => {
    await renderPage();

    expect(mocks.getPublicSettlementByToken).toHaveBeenCalledWith(token);
    expect(screen.getByText("그린빌라 · 101동 201호")).toBeInTheDocument();
    expect(screen.getByText("2026.08.25")).toBeInTheDocument();
    expect(screen.getByText("추가납부")).toBeInTheDocument();
    expect(screen.getByText("218,806원")).toBeInTheDocument();
    expect(screen.queryByText(/010-/)).not.toBeInTheDocument();
  });
});
