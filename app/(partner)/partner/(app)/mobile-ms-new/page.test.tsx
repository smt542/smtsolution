import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPartnerSettlementContextData: vi.fn(),
  push: vi.fn(),
}));

vi.mock("./data", () => ({
  getPartnerSettlementContextData: mocks.getPartnerSettlementContextData,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

import PartnerMsNewPage from "./page";

const contextData = {
  unit: {
    id: 7,
    unit_no: "201호",
    dong: "A동",
    building_id: 3,
    building_name: "해오름빌라",
  },
  occupancy: {
    id: 11,
    tenant_name: "김주민",
    phone: "010-0000-0000",
    move_in_date: "2026-01-01",
    settlement_note: null,
    status: "occupied",
  },
  latest_settlement: null,
  settle_account: {
    settle_bank: "관리은행",
    settle_acct: "123-456",
    settle_holder: "해오름관리",
  },
  checklist: [{ id: 31, label: "열쇠 반납", checked: false }],
  meter_summary: [
    {
      utility: "water",
      previous_reading: 10,
      current_reading: 12,
      usage: 2,
    },
  ],
};

const renderPage = async (query: {
  unitId?: string | string[];
  settlementId?: string | string[];
}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {await PartnerMsNewPage({
        searchParams: Promise.resolve(query),
      })}
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPartnerSettlementContextData.mockResolvedValue(contextData);
});

describe("PartnerMsNewPage", () => {
  it("loads the first query values on the server and keeps form interaction", async () => {
    const user = userEvent.setup();
    await renderPage({ unitId: ["7", "8"] });

    expect(mocks.getPartnerSettlementContextData).toHaveBeenCalledWith(7, null);
    expect(screen.getByText("이사정산 등록")).toBeInTheDocument();
    expect(screen.getByText("해오름빌라 · A동 201호 · 김주민")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "공과금 정산" }));
    expect(screen.getByText("수도")).toBeInTheDocument();
  });

  it("preserves edit mode and the settlement id RPC argument", async () => {
    await renderPage({ unitId: "7", settlementId: "19" });

    expect(mocks.getPartnerSettlementContextData).toHaveBeenCalledWith(7, 19);
    expect(screen.getByText("이사정산 상세")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("handles an invalid unit without calling the RPC", async () => {
    const user = userEvent.setup();
    await renderPage({ unitId: "invalid" });

    expect(mocks.getPartnerSettlementContextData).not.toHaveBeenCalled();
    expect(screen.getByText("정산 정보를 불러오지 못했어요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "돌아가기" }));
    expect(mocks.push).toHaveBeenCalledWith("/partner/mobile-inquiry");
  });

  it("preserves the load error state when the server RPC fails", async () => {
    mocks.getPartnerSettlementContextData.mockRejectedValue(
      new Error("failed"),
    );
    await renderPage({ unitId: "7" });

    expect(screen.getByText("정산 정보를 불러오지 못했어요")).toBeInTheDocument();
  });
});
