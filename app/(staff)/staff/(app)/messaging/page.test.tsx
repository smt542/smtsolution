import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyContext } from "@/hooks/reactquery/auth";
import type { MessageLog } from "@/hooks/reactquery/messaging";
import type { MessagingPreset, SendMode } from "@/lib/messaging/preset";

const { composerSpy, getStaffContext } = vi.hoisted(() => ({
  composerSpy: vi.fn(),
  getStaffContext: vi.fn(),
}));

vi.mock("../_staffContext", () => ({ getStaffContext }));
vi.mock("@/hooks/reactquery/messaging", () => ({
  useMessageLogs: vi.fn(),
  useScheduledMessages: () => ({ data: [] }),
}));
vi.mock("@/hooks/reactquery/messageTemplates", () => ({
  useMessageTemplates: () => ({ data: [] }),
}));
vi.mock("./components/MessagingComposer", () => ({
  MessagingComposer: (props: {
    preset?: MessagingPreset;
    initialMode?: SendMode;
    onSent?: (result: { logId: number; count: number }) => void;
  }) => {
    composerSpy(props);
    return <div data-testid="messaging-composer">COMPOSER</div>;
  },
}));
vi.mock("./components/TemplatesTab", () => ({
  TemplatesTab: () => <button type="button">새 템플릿</button>,
}));

import { useMessageLogs } from "@/hooks/reactquery/messaging";
import { MessageLogList } from "./components/MessageLogList";
import { MessagingModal } from "./components/MessagingModal";
import MessagingPage from "./page";

const allowedUser: MyContext = {
  orgId: 9,
  role: "staff",
  orgStatus: "active",
  username: "manager",
  fullName: "관리 직원",
  isActive: true,
  mustChangePassword: false,
  staffType: "manager_staff",
  permissions: ["messaging"],
};

const logs: MessageLog[] = [
  {
    id: 31,
    orgId: 9,
    channel: "sms",
    body: "8월 관리비 납부를 부탁드립니다.",
    context: "독촉",
    recipientCount: 2,
    recipients: [],
    result: "stub",
    sentBy: "user-1",
    sentAt: "2026-08-13T01:30:00.000Z",
    templateId: null,
    estimatedPoints: 1,
    chargedPoints: 0,
    pointStatus: "quoted",
  },
];

const refetchLogs = vi.fn();

function setup({
  me = allowedUser,
  messageLogs = logs,
  isLogsLoading = false,
  isLogsFetching = false,
  logsError = null,
}: {
  me?: MyContext | null;
  messageLogs?: MessageLog[];
  isLogsLoading?: boolean;
  isLogsFetching?: boolean;
  logsError?: Error | null;
} = {}) {
  getStaffContext.mockResolvedValue(me);
  vi.mocked(useMessageLogs).mockReturnValue({
    data: messageLogs,
    isLoading: isLogsLoading,
    isFetching: isLogsFetching,
    error: logsError,
    refetch: refetchLogs,
  } as unknown as ReturnType<typeof useMessageLogs>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

describe("MessagingPage", () => {
  it("messaging 권한이 없으면 화면을 차단하고 이력을 조회하지 않는다", async () => {
    setup({ me: { ...allowedUser, permissions: [] } });

    render(await MessagingPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("문자 발송 권한이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByTestId("messaging-composer")).not.toBeInTheDocument();
    expect(useMessageLogs).not.toHaveBeenCalled();
  });

  it("예약·내역·템플릿 탭을 렌더하고 전환한다", async () => {
    render(await MessagingPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("tab", { name: /^예약 발송/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /^템플릿 관리/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^발송 내역/ })).toBeInTheDocument();
    expect(screen.getByText("예약된 발송이 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^템플릿 관리/ }));
    expect(screen.getByRole("button", { name: "새 템플릿" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^발송 내역/ }));
    expect(screen.getByRole("columnheader", { name: "발신자" })).toBeInTheDocument();
    expect(screen.getByText("2026.08.13 10:30")).toBeInTheDocument();
    expect(screen.getByText("독촉 / 2명")).toBeInTheDocument();
    expect(screen.getAllByText("SMS")).toHaveLength(2);
    expect(screen.getByText("8월 관리비 납부를 부탁드립니다.")).toBeInTheDocument();
    expect(screen.getByText("stub")).toBeInTheDocument();
  });

  it("발송 이력 조회 오류를 표시하고 재시도하면 쿼리를 다시 요청한다", async () => {
    setup({ messageLogs: [], logsError: new Error("network error") });
    render(await MessagingPage({ searchParams: Promise.resolve({}) }));
    fireEvent.click(screen.getByRole("tab", { name: /^발송 내역/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "발송 내역을 불러오지 못했습니다.",
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetchLogs).toHaveBeenCalledOnce();
  });

  it("tab 쿼리로 초기 탭을 선택한다", async () => {
    render(
      await MessagingPage({
        searchParams: Promise.resolve({ tab: "history" }),
      }),
    );

    expect(screen.getByRole("tab", { name: /^발송 내역/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("독촉 / 2명")).toBeInTheDocument();
    expect(screen.queryByTestId("messaging-composer")).not.toBeInTheDocument();
  });

  it("기존 발송 이력을 유지한 채 백그라운드 갱신 상태를 표시한다", async () => {
    setup({ isLogsFetching: true });

    render(
      await MessagingPage({
        searchParams: Promise.resolve({ tab: "history" }),
      }),
    );

    expect(screen.getByText("독촉 / 2명")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "발송 내역 갱신 중" }),
    ).toBeInTheDocument();
  });
});

describe("MessageLogList", () => {
  it("로딩 상태와 빈 상태를 표시한다", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <MessageLogList logs={[]} isLoading onRetry={onRetry} />,
    );
    expect(
      screen.getByRole("status", { name: "발송 이력 불러오는 중" }),
    ).toBeInTheDocument();

    rerender(<MessageLogList logs={[]} onRetry={onRetry} />);
    expect(screen.getByText("발송 이력이 없습니다.")).toBeInTheDocument();
  });
});

describe("MessagingModal", () => {
  it("닫힌 상태에서는 Composer를 렌더하지 않는다", () => {
    render(<MessagingModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("messaging-composer")).not.toBeInTheDocument();
  });

  it("열린 상태에서 preset과 onSent를 Composer에 전달한다", () => {
    const preset: MessagingPreset = {
      context: "독촉",
      body: "납부를 부탁드립니다.",
      recipients: [
        { name: "김입주", phone: "010-1000-0000", kind: "tenant" },
      ],
    };
    const onSent = vi.fn();

    render(
      <MessagingModal
        open
        preset={preset}
        onClose={vi.fn()}
        onSent={onSent}
      />,
    );

    expect(screen.getByTestId("messaging-composer")).toBeInTheDocument();
    expect(composerSpy).toHaveBeenCalledWith({
      preset,
      onSent,
      initialMode: "sms",
    });
  });
});
