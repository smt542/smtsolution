import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/messaging", () => ({
  useMessageLogs: () => ({
    data: [
      {
        id: 1,
        orgId: 9,
        channel: "auto",
        body: "자동 안내 본문",
        context: "manual",
        recipientCount: 2,
        recipients: [],
        result: "stub",
        sentBy: null,
        sentAt: "2026-08-18T00:00:00Z",
        templateId: 5,
      },
      {
        id: 2,
        orgId: 9,
        channel: "sms",
        body: "독촉 문자 본문",
        context: "독촉",
        recipientCount: 1,
        recipients: [],
        result: "stub",
        sentBy: null,
        sentAt: "2026-08-17T00:00:00Z",
        templateId: null,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import { HistoryTab } from "./HistoryTab";

function renderTab(ui: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {ui}
    </QueryClientProvider>,
  );
}

describe("HistoryTab", () => {
  it("채널 필터로 발송 이력 행을 좁힌다", () => {
    renderTab(<HistoryTab />);

    expect(screen.getByText("자동 안내 본문")).toBeInTheDocument();
    expect(screen.getByText("독촉 문자 본문")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("채널"), {
      target: { value: "auto" },
    });

    expect(screen.getByText("자동 안내 본문")).toBeInTheDocument();
    expect(screen.queryByText("독촉 문자 본문")).not.toBeInTheDocument();
  });

  it("context 필터로 발송 이력 행을 좁힌다", () => {
    renderTab(<HistoryTab />);

    fireEvent.change(screen.getByLabelText("발송 구분"), {
      target: { value: "독촉" },
    });

    expect(screen.queryByText("자동 안내 본문")).not.toBeInTheDocument();
    expect(screen.getByText("독촉 문자 본문")).toBeInTheDocument();
  });
});
