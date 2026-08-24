import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutateAsync } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useTenantList: vi.fn(),
}));
vi.mock("@/hooks/reactquery/accounts", () => ({ useAccounts: vi.fn() }));
vi.mock("@/hooks/reactquery/quickMessages", () => ({
  useQuickMessages: vi.fn(),
}));
vi.mock("@/hooks/reactquery/messageTemplates", () => ({
  useMessageTemplates: vi.fn(),
}));
vi.mock("@/hooks/reactquery/messaging", () => ({
  useMessagePointQuote: vi.fn(),
  useSendMessages: vi.fn(),
  useTenantAlimtalkConsent: vi.fn(),
  MessageSendError: class MessageSendError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "MessageSendError";
    }
  },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useTenantList } from "@/hooks/reactquery/occupancies";
import { useQuickMessages } from "@/hooks/reactquery/quickMessages";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates";
import {
  MessageSendError,
  useMessagePointQuote,
  useSendMessages,
  useTenantAlimtalkConsent,
} from "@/hooks/reactquery/messaging";
import { MessagingComposer } from "./MessagingComposer";

const buildings = [
  {
    id: 7,
    orgId: 1,
    code: "B-001",
    name: "그린빌라",
    address: null,
    typeId: null,
    ownerName: "이건물주",
    ownerPhone: "010-7000-0000",
    entrancePassword: null,
    managerUserId: null,
    meterUserId: null,
    cleaningUserId: null,
    facilities: {},
    memo: null,
  },
];

const tenants = [
  {
    unitId: 11,
    occupancyId: 101,
    unitNo: "101호",
    tenantName: "김입주",
    phone: "010-1000-0000",
    roomTypeLabel: "원룸",
    residentCount: 1,
    moveInDate: "2026-01-01",
    isVacant: false,
    isOverdue: false,
  },
];

const accounts = [
  {
    userId: "staff-1",
    username: "staff",
    fullName: "박직원",
    phone: "010-9000-0000",
    phoneSub: null,
    role: "staff",
    staffType: "manager_staff",
    affiliation: null,
    isActive: true,
    permissions: [],
    roleLabels: [],
  },
];

const confirmSpy = vi.spyOn(window, "confirm");

beforeEach(() => {
  vi.clearAllMocks();
  confirmSpy.mockReturnValue(true);
  mutateAsync.mockResolvedValue({ logId: 55, count: 1, status: "queued", scheduledAt: null, recipients: [], queuedCount: 1, reservedPoints: 1 });
  vi.mocked(useBuildings).mockReturnValue({
    data: buildings,
    isLoading: false,
  } as unknown as ReturnType<typeof useBuildings>);
  vi.mocked(useTenantList).mockReturnValue({
    data: tenants,
    isLoading: false,
  } as unknown as ReturnType<typeof useTenantList>);
  vi.mocked(useAccounts).mockReturnValue({
    data: accounts,
    isLoading: false,
  } as unknown as ReturnType<typeof useAccounts>);
  vi.mocked(useQuickMessages).mockReturnValue({
    data: [
      {
        id: 3,
        orgId: 1,
        title: "점검 안내",
        body: "오늘 소방 점검이 있습니다.",
        sortOrder: 0,
      },
    ],
  } as unknown as ReturnType<typeof useQuickMessages>);
  vi.mocked(useMessageTemplates).mockReturnValue({
    data: [
      {
        id: 5,
        orgId: 1,
        title: "납부 안내",
        body: "#{이름}님 #{호실} #{건물명} 관리비를 확인해 주세요.",
        sortOrder: 0,
      },
    ],
    isLoading: false,
  } as unknown as ReturnType<typeof useMessageTemplates>);
  vi.mocked(useTenantAlimtalkConsent).mockReturnValue({
    data: [
      { occupancyId: 101, alimtalkOptIn: true, smsOptIn: true },
    ],
    isLoading: false,
  } as unknown as ReturnType<typeof useTenantAlimtalkConsent>);
  vi.mocked(useSendMessages).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useSendMessages>);
  vi.mocked(useMessagePointQuote).mockImplementation((input) => ({
    data: input
      ? {
          recipientCount: input.recipients.length,
          excludedCount: 0,
          channelCounts: {
            sms: input.mode === "sms" ? input.recipients.length : 0,
            lms: 0,
            alimtalk: input.mode === "sms" ? 0 : input.recipients.length,
          },
          rateSnapshot: {
            sms: { rateId: 1, points: 1 },
            lms: { rateId: 3, points: 3 },
            alimtalk: { rateId: 2, points: 1 },
          },
          ledgerBalance: 100,
          reservedPoints: 0,
          availablePoints: 100,
          estimatedPoints: input.recipients.length,
          sufficient: true,
        }
      : undefined,
    isPending: false,
    isFetching: false,
    error: null,
  }) as unknown as ReturnType<typeof useMessagePointQuote>);
});

describe("MessagingComposer", () => {
  it("SMS 채널과 세대·건물주·직원 수신처를 표시하고 선택 수를 갱신", () => {
    render(<MessagingComposer initialMode="sms" />);

    expect(screen.getByLabelText("발송 모드")).toHaveValue("sms");
    expect(screen.getByRole("heading", { name: "세대" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "건물주" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "직원" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("건물 선택"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByLabelText(/101호 · 김입주/));
    expect(screen.getAllByText("1명").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText(/이건물주/));
    fireEvent.click(screen.getByLabelText(/박직원/));
    expect(screen.getAllByText("3명").length).toBeGreaterThan(0);
  });

  it("본문을 입력하고 자주 보내는 문구를 삽입", () => {
    render(<MessagingComposer initialMode="sms" />);

    fireEvent.change(screen.getByLabelText("본문"), {
      target: { value: "안녕하세요." },
    });
    fireEvent.change(screen.getByLabelText("자주 보내는 문자"), {
      target: { value: "3" },
    });

    expect(screen.getByLabelText("본문")).toHaveValue(
      "안녕하세요.\n오늘 소방 점검이 있습니다.",
    );
  });

  it("preset 초기값을 반영하고 확인 후 유효 수신처만 발송", async () => {
    const onSent = vi.fn();
    render(
      <MessagingComposer
        initialMode="sms"
        preset={{
          context: "독촉",
          body: "미납 관리비를 확인해 주세요.",
          recipients: [
            {
              name: "김입주",
              phone: "010-1000-0000",
              unitNo: "101호",
              kind: "tenant",
              ref: { occupancyId: 101 },
            },
            { name: "연락처없음", phone: null, kind: "tenant" },
          ],
        }}
        onSent={onSent}
      />,
    );

    expect(screen.getByLabelText("본문")).toHaveValue(
      "미납 관리비를 확인해 주세요.",
    );
    expect(screen.getAllByText("1명").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "발송" }));

    await waitFor(() =>
      expect(confirmSpy).toHaveBeenCalledWith(
        "1명 · 예상 1 P (성공 발송분만 차감)\n발송하시겠습니까?",
      ),
    );
    expect(mutateAsync).toHaveBeenCalledWith({
      mode: "sms",
      body: "미납 관리비를 확인해 주세요.",
      context: "독촉",
      templateId: null,
      recipients: [
        {
          name: "김입주",
          phone: "010-1000-0000",
          unitNo: "101호",
          kind: "tenant",
          ref: { occupancyId: 101 },
          channel: "sms",
          renderedBody: "미납 관리비를 확인해 주세요.",
        },
      ],
      scheduledAt: null,
      idempotencyKey: expect.any(String),
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("발송을 접수했습니다 · 1건 · 결과 확인 중"),
    );
    expect(onSent).toHaveBeenCalledWith({
      logId: 55,
      count: 1,
      status: "queued",
      scheduledAt: null,
      recipients: [],
      queuedCount: 1,
      reservedPoints: 1,
    });
  });

  it("공급자 미설정이면 PROVIDER_NOT_CONFIGURED 오류 토스트", async () => {
    mutateAsync.mockRejectedValueOnce(
      new MessageSendError("PROVIDER_NOT_CONFIGURED", "발송 공급자가 설정되지 않았습니다."),
    );
    render(
      <MessagingComposer
        initialMode="sms"
        preset={{
          context: "독촉",
          body: "미납 관리비를 확인해 주세요.",
          recipients: [{ name: "김입주", phone: "010-1000-0000", unitNo: "101호", kind: "tenant", ref: { occupancyId: 101 } }],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("발송 공급자가 설정되지 않아 발송할 수 없습니다."),
    );
  });

  it("중복된 정규화 전화번호를 한 명으로 표시하고 한 번만 발송", async () => {
    render(
      <MessagingComposer
        initialMode="sms"
        preset={{
          context: "manual",
          body: "중복 수신처 확인",
          recipients: [
            {
              name: "첫 번째 수신처",
              phone: "010-5555-1234",
              kind: "tenant",
              ref: { occupancyId: 101 },
            },
            {
              name: "두 번째 수신처",
              phone: "01055551234",
              kind: "staff",
              ref: { userId: "staff-duplicate" },
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("1명").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "발송" }));

    await waitFor(() =>
      expect(confirmSpy).toHaveBeenCalledWith(
        "1명 · 예상 1 P (성공 발송분만 차감)\n발송하시겠습니까?",
      ),
    );
    expect(mutateAsync).toHaveBeenCalledWith({
      mode: "sms",
      body: "중복 수신처 확인",
      context: "manual",
      templateId: null,
      recipients: [
        {
          name: "첫 번째 수신처",
          phone: "010-5555-1234",
          kind: "tenant",
          ref: { occupancyId: 101 },
          channel: "sms",
          renderedBody: "중복 수신처 확인",
        },
      ],
      scheduledAt: null,
      idempotencyKey: expect.any(String),
    });
  });

  it("목록 RPC가 현재 입주자의 전화번호를 주지 않으면 수신처를 비활성화", () => {
    vi.mocked(useTenantList).mockReturnValue({
      data: [{ ...tenants[0], phone: null }],
      isLoading: false,
    } as unknown as ReturnType<typeof useTenantList>);

    render(<MessagingComposer initialMode="sms" />);
    fireEvent.change(screen.getByLabelText("건물 선택"), {
      target: { value: "7" },
    });

    expect(
      screen.getByLabelText("101호 · 김입주 · 연락처 없음"),
    ).toBeDisabled();
    expect(screen.getAllByText("0명").length).toBeGreaterThan(0);
  });

  it("수신처 또는 본문이 비어 있으면 안내하고 발송하지 않음", () => {
    render(<MessagingComposer initialMode="sms" />);

    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    expect(toast.info).toHaveBeenCalledWith("수신처를 선택해 주세요.");

    fireEvent.click(screen.getByLabelText(/박직원/));
    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    expect(toast.info).toHaveBeenCalledWith("본문을 입력해 주세요.");
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("자동 모드에서 템플릿 미선택이면 발송을 비활성화한다", () => {
    render(
      <MessagingComposer
        initialMode="auto"
        preset={{
          context: "manual",
          body: "본문",
          recipients: [
            {
              name: "김입주",
              phone: "010-1000-0000",
              unitNo: "101호",
              kind: "tenant",
              ref: { occupancyId: 101 },
            },
          ],
        }}
      />,
    );

    expect(screen.getByLabelText("발송 모드")).toHaveValue("auto");
    expect(screen.getByRole("button", { name: "발송" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("템플릿 본문을 편집 가능한 본문에 채우고 수신처별 예상 채널과 렌더 결과를 발송한다", async () => {
    render(<MessagingComposer initialMode="auto" />);

    fireEvent.change(screen.getByLabelText("건물 선택"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("알림톡 템플릿"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByLabelText(/101호 · 김입주/));

    expect(screen.getByLabelText("본문")).toHaveValue(
      "#{이름}님 #{호실} #{건물명} 관리비를 확인해 주세요.",
    );
    expect(screen.getByText("예상 알림톡")).toBeInTheDocument();
    expect(
      screen.getByText("김입주님 101호 그린빌라 관리비를 확인해 주세요."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "발송" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        mode: "auto",
        body: "#{이름}님 #{호실} #{건물명} 관리비를 확인해 주세요.",
        context: "manual",
        templateId: 5,
        recipients: [
          {
            name: "김입주",
            phone: "010-1000-0000",
            unitNo: "101호",
            kind: "tenant",
            ref: { occupancyId: 101, buildingId: 7 },
            channel: "alimtalk",
            renderedBody:
              "김입주님 101호 그린빌라 관리비를 확인해 주세요.",
          },
        ],
        scheduledAt: null,
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it("예약 날짜·시간을 공용 API에 전달하고 지정 형식 토스트를 표시", async () => {
    mutateAsync.mockResolvedValueOnce({
      logId: 77,
      count: 1,
      status: "scheduled",
      scheduledAt: "2099-08-20T00:30:00.000Z",
      recipients: [],
    });
    render(
      <MessagingComposer
        initialMode="sms"
        preset={{
          context: "고지서",
          body: "관리비 고지서입니다.",
          recipients: [{ name: "김입주", phone: "010-1000-0000", kind: "tenant" }],
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("발송 시점"), { target: { value: "scheduled" } });
    fireEvent.change(screen.getByLabelText("예약 발송 일시"), { target: { value: "2099-08-20T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "예약 발송" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      scheduledAt: new Date("2099-08-20T09:30").toISOString(),
    })));
    expect(toast.success).toHaveBeenCalledWith("예약이 등록되었습니다(2099-08-20 09:30)");
  });

  it("알림톡 모드에서 미동의 수신처를 경고하고 적격자가 없으면 차단한다", () => {
    vi.mocked(useTenantAlimtalkConsent).mockReturnValue({
      data: [{ occupancyId: 101, alimtalkOptIn: false, smsOptIn: true }],
      isLoading: false,
    } as unknown as ReturnType<typeof useTenantAlimtalkConsent>);
    vi.mocked(useMessagePointQuote).mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      error: new Error("발송 가능한 수신처가 없습니다."),
    } as unknown as ReturnType<typeof useMessagePointQuote>);

    render(<MessagingComposer initialMode="alimtalk" />);
    fireEvent.change(screen.getByLabelText("건물 선택"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("알림톡 템플릿"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByLabelText(/101호 · 김입주/));

    expect(
      screen.getByText("알림톡 미동의 수신처 1명은 제외됩니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("예상 제외")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "발송" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    expect(toast.info).toHaveBeenCalledWith(
      "알림톡 수신에 동의한 수신처가 없습니다.",
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  const singlePreset = {
    context: "manual",
    body: "본문",
    recipients: [
      {
        name: "김입주",
        phone: "010-1000-0000",
        unitNo: "101호",
        kind: "tenant" as const,
        ref: { occupancyId: 101 },
      },
    ],
  };

  it("중복 클릭(동일 초안)은 같은 Idempotency-Key로 발송한다", async () => {
    render(<MessagingComposer initialMode="sms" preset={singlePreset} />);
    const button = screen.getByRole("button", { name: "발송" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    const key1 = mutateAsync.mock.calls[0][0].idempotencyKey as string;
    const key2 = mutateAsync.mock.calls[1][0].idempotencyKey as string;
    expect(key1).toBeTruthy();
    expect(key1).toBe(key2);
  });

  it("성공 발송 후에는 새 Idempotency-Key로 회전한다", async () => {
    render(<MessagingComposer initialMode="sms" preset={singlePreset} />);
    const button = screen.getByRole("button", { name: "발송" });
    fireEvent.click(button);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    const key1 = mutateAsync.mock.calls[0][0].idempotencyKey as string;
    const key2 = mutateAsync.mock.calls[1][0].idempotencyKey as string;
    expect(key1).toBeTruthy();
    expect(key1).not.toBe(key2);
  });

  it("견적 입력에 수신자별 최종 renderedBody를 담아 SMS/LMS 판정을 접수와 일치시킨다(개인화 2명)", () => {
    vi.mocked(useTenantList).mockReturnValue({
      data: [
        { ...tenants[0], unitId: 11, occupancyId: 101, unitNo: "101호", tenantName: "김일", phone: "010-1000-0001" },
        { ...tenants[0], unitId: 12, occupancyId: 102, unitNo: "102호", tenantName: "이이", phone: "010-1000-0002" },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useTenantList>);

    render(<MessagingComposer initialMode="sms" />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("본문"), {
      target: { value: "#{이름}님 관리비 안내" },
    });
    fireEvent.click(screen.getByLabelText(/101호 · 김일/));
    fireEvent.click(screen.getByLabelText(/102호 · 이이/));

    const calls = vi.mocked(useMessagePointQuote).mock.calls;
    const lastInput = calls[calls.length - 1][0];
    expect(lastInput).not.toBeNull();
    const bodies = (lastInput!.recipients as Array<{ renderedBody?: string }>).map(
      (r) => r.renderedBody,
    );
    expect(bodies).toContain("김일님 관리비 안내");
    expect(bodies).toContain("이이님 관리비 안내");
  });

  it("발송이 확정 거절되면 onFailed로 처리하고 onSent(=queued 기록)를 호출하지 않는다", async () => {
    // 고지서 흐름: onSent가 record_bill_delivery(queued)를 기록하므로, 확정 거절 시 onSent가
    // 호출되면 안 된다(receipt 없이 queued로 기록 금지). onFailed만 호출되어야 한다.
    mutateAsync.mockRejectedValueOnce(
      new MessageSendError("SEND_REJECTED", "모든 발송이 확정 거절되었습니다."),
    );
    const onSent = vi.fn();
    const onFailed = vi.fn();
    render(
      <MessagingComposer
        initialMode="sms"
        preset={singlePreset}
        onSent={onSent}
        onFailed={onFailed}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1));
    expect(onSent).not.toHaveBeenCalled();
  });

  it("SEND_IN_PROGRESS는 비종결 정보 응답으로 onSent/onFailed 모두 호출하지 않고 키를 유지한다", async () => {
    // 진행 중(reserved replay)은 성공도 실패도 아니다. 종결 콜백을 부르지 않고 같은 키로 재시도할 수 있어야 한다.
    mutateAsync.mockRejectedValue(
      new MessageSendError("SEND_IN_PROGRESS", "동일 요청이 처리 중입니다."),
    );
    const onSent = vi.fn();
    const onFailed = vi.fn();
    render(
      <MessagingComposer
        initialMode="sms"
        preset={singlePreset}
        onSent={onSent}
        onFailed={onFailed}
      />,
    );
    const button = screen.getByRole("button", { name: "발송" });
    fireEvent.click(button);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(onSent).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
    const key1 = mutateAsync.mock.calls[0][0].idempotencyKey as string;
    const key2 = mutateAsync.mock.calls[1][0].idempotencyKey as string;
    expect(key1).toBeTruthy();
    expect(key1).toBe(key2); // 비종결 → 멱등 키 유지(재시도 안전)
  });

  it("SEND_UNCONFIRMED도 비종결 정보 응답으로 onSent/onFailed를 호출하지 않는다", async () => {
    mutateAsync.mockRejectedValueOnce(
      new MessageSendError("SEND_UNCONFIRMED", "발송 접수 결과를 확인하지 못했습니다."),
    );
    const onSent = vi.fn();
    const onFailed = vi.fn();
    render(
      <MessagingComposer
        initialMode="sms"
        preset={singlePreset}
        onSent={onSent}
        onFailed={onFailed}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(onSent).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });
});
