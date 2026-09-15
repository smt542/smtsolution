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
      {
        id: 3,
        orgId: 9,
        channel: "alimtalk",
        body: "알림톡 본문",
        context: "manual",
        recipientCount: 3,
        recipients: [],
        result: "stub",
        sentBy: null,
        sentAt: "2026-08-16T00:00:00Z",
        templateId: null,
      },
    ],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import { HistoryTab } from "./HistoryTab";

function renderTab(ui: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );
}

describe("HistoryTab", () => {
  it("알림톡 채널 필터로 발송 내역 행을 좁힌다", () => {
    renderTab(<HistoryTab />);

    expect(screen.getByText("자동 안내 본문")).toBeInTheDocument();
    expect(screen.getByText("독촉 문자 본문")).toBeInTheDocument();
    expect(screen.getByText("알림톡 본문")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "알림톡" }));

    expect(screen.getByText("알림톡 본문")).toBeInTheDocument();
    expect(screen.queryByText("자동 안내 본문")).not.toBeInTheDocument();
    expect(screen.queryByText("독촉 문자 본문")).not.toBeInTheDocument();
  });

  it("문자(SMS) 채널 필터는 알림톡을 제외한 행만 남긴다", () => {
    renderTab(<HistoryTab />);

    fireEvent.click(screen.getByRole("button", { name: "문자(SMS)" }));

    expect(screen.getByText("자동 안내 본문")).toBeInTheDocument();
    expect(screen.getByText("독촉 문자 본문")).toBeInTheDocument();
    expect(screen.queryByText("알림톡 본문")).not.toBeInTheDocument();
  });
});
