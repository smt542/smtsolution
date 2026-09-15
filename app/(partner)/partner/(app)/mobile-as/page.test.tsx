import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));

import PartnerAsDetailPage from "./page";

const detail = {
  id: 17,
  building_name: "그린빌라",
  unit_label: "101호",
  category_id: 2,
  content: "수도 누수 확인",
  status: "in_progress",
  reporter_phone: "010-1234-5678",
  logger_name: "관리실",
  assigned_name: "현장기사",
  received_at: "2026-09-10T09:00:00+09:00",
  completed_at: "2026-09-11T14:30:00+09:00",
  result_content: "부품 교체 예정",
  is_mine: true,
};

async function renderPage(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {await PartnerAsDetailPage({ searchParams: Promise.resolve({ id }) })}
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "partner_get_complaint") return Promise.resolve({ data: [detail], error: null });
    if (name === "partner_list_as_categories") {
      return Promise.resolve({ data: [{ id: 2, label: "배관" }], error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
});

describe("PartnerAsDetailPage", () => {
  it("Server searchParams의 ID로 상세와 카테고리를 조회한다", async () => {
    await renderPage("17");

    expect(await screen.findByText("그린빌라")).toBeInTheDocument();
    expect(screen.getByText("101호")).toBeInTheDocument();
    expect(screen.getByDisplayValue("수도 누수 확인")).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("partner_get_complaint", { p_id: 17 });
    expect(mocks.rpc).toHaveBeenCalledWith("partner_list_as_categories");
  });

  it("유효한 ID가 없으면 RPC 없이 기존 빈 상태를 표시한다", async () => {
    await renderPage("invalid");

    expect(await screen.findByText("접수 내역을 찾을 수 없어요")).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("편집 확인 후 기존 update RPC와 이동 동작을 유지한다", async () => {
    await renderPage("17");
    await screen.findByDisplayValue("수도 누수 확인");

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByText("저장할까요?")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "저장" }).at(-1)!);

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
      "partner_update_complaint",
      expect.objectContaining({ p_id: 17, p_content: "수도 누수 확인" }),
    ));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/partner/mobile-home"),
    );
  });
});
