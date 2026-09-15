import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { DrainScheduledButton } from "./DrainScheduledButton";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderButton() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DrainScheduledButton />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DrainScheduledButton", () => {
  it("예약분을 세션 인증으로 처리하고 집계 결과를 토스트로 표시한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        claimed: 4,
        sent: 2,
        failed: 1,
        unconfigured: 1,
        chargedPoints: 7,
      }),
    );

    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "예약분 지금 처리" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/messaging/dispatch-scheduled",
        { method: "POST" },
      ),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "처리 4 · 발송 2 · 실패 1 · 미설정 1",
    );
  });

  it("권한 오류는 전용 메시지를 표시한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "forbidden" }, 403),
    );

    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "예약분 지금 처리" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("권한이 없습니다."),
    );
  });

  it("그 밖의 HTTP 오류는 일반 실패 메시지를 표시한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "internal_error" }, 500),
    );

    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "예약분 지금 처리" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("처리에 실패했습니다."),
    );
  });

  it("네트워크 오류를 안내한다", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));

    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "예약분 지금 처리" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "네트워크 오류로 처리하지 못했습니다.",
      ),
    );
  });
});
