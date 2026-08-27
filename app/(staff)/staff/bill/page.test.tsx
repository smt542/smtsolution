// app/(staff)/staff/bill/page.test.tsx
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MessagingPreset } from "@/lib/messaging/preset";

const h = vi.hoisted(() => ({
  recordMutateAsync: vi.fn(),
  mintMutateAsync: vi.fn(),
  modal: {
    open: false,
    onSent: null as null | ((result: unknown) => void | Promise<void>),
    preset: undefined as MessagingPreset | undefined,
  },
}));

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildings: () => ({ data: [{ id: 7, orgId: 1, code: "B007", name: "행복빌라", address: "서울시" }], isLoading: false }),
}));
vi.mock("@/hooks/reactquery/setupConfig", () => ({
  useSetupConfig: () => ({
    data: {
      unitLabelDefault: "code",
      mgmtBank1: "국민은행",
      mgmtAcct1: "123-456-789",
      mgmtPrint1: false,
      mgmtPrint2: false,
    },
  }),
}));
vi.mock("@/hooks/reactquery/org/useOrgContact", () => ({
  useOrgContact: () => ({ data: { phone: "02-1234-5678" } }),
}));
vi.mock("@/hooks/reactquery/bill", () => ({
  useBillTargets: vi.fn(() => ({ data: [], isLoading: false })),
  useBillDocuments: () => ({ data: [] }),
  useBillOrganizationName: () => ({ data: "한빛관리" }),
  useIssueBills: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRecordBillDelivery: () => ({ mutateAsync: h.recordMutateAsync, isPending: false }),
  useSendBillFaxes: () => ({ mutateAsync: vi.fn(), isPending: false }),
  billKeys: { targets: vi.fn(), documents: vi.fn() },
  listBillTargets: vi.fn(),
  getBillDocuments: vi.fn(),
}));
vi.mock("@/hooks/reactquery/messaging", () => ({
  useCancelScheduledMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/reactquery/residentBilling", () => ({
  useStaffMintBillTokens: () => ({
    mutateAsync: h.mintMutateAsync,
    isPending: false,
  }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock(
  "@/app/(staff)/staff/messaging/components/MessagingModal",
  () => ({
    MessagingModal: (props: {
      open: boolean;
      preset?: MessagingPreset;
      onSent?: (result: unknown) => void | Promise<void>;
    }) => {
      h.modal.open = props.open;
      h.modal.onSent = props.onSent ?? null;
      h.modal.preset = props.preset;
      return null;
    },
  }),
);

import BillPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillTargets } from "@/hooks/reactquery/bill";
import { buildRecipientRenderVariables } from "@/lib/messaging/preset";
import { renderTemplate } from "@/lib/messaging/render";
import { toast } from "sonner";

const billTarget = {
  unitId: 101,
  unitNo: "1001",
  dong: "101",
  occupancyId: 401,
  tenantName: "김입주",
  payerName: null,
  payerNo: null,
  billNameDisplay: "name",
  phone: "010-1111-2222",
  secondaryPhone: "010-3333-4444",
  faxNumber: null,
  totalAmount: 120_000,
  autoDebit: false,
  issueType: null,
  dueDate: "2026-08-31",
  sendStatus: null,
  issuedAt: null,
  singlePrint: false,
  waterCutoff: false,
  scheduledAt: null,
  messageScheduleId: null,
  kakaoSendStatus: null,
  faxSendStatus: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_RESIDENT_WEB_ORIGIN", "https://resident.example.com/");
  h.mintMutateAsync.mockResolvedValue([{ unitId: 101, token: "bill-token-101" }]);
  h.modal.open = false;
  h.modal.onSent = null;
  h.modal.preset = undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("BillPage 게이트", () => {
  it("bill_publish 권한 없으면 차단", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { role: "field_staff", permissions: [] },
    } as unknown as ReturnType<typeof useMe>);
    render(<BillPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });

  it("권한 있으면 문서 카드 랜딩 노출", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { role: "staff", orgId: 1, permissions: ["bill_publish"] },
    } as unknown as ReturnType<typeof useMe>);
    render(<BillPage />);
    expect(screen.getByRole("heading", { name: "서류 발행·출력" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /지로 고지서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /조정명세서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /자동이체 세대 출력/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /팩스 발송/ })).toBeInTheDocument();
  });

  it("즉시 카톡 고지서 접수는 sent가 아니라 queued로 기록하고 message_log_id를 연결한다", async () => {
    h.recordMutateAsync.mockResolvedValue({ count: 1 });
    vi.mocked(useMe).mockReturnValue({
      data: { role: "staff", orgId: 1, permissions: ["bill_publish"] },
    } as unknown as ReturnType<typeof useMe>);
    vi.mocked(useBillTargets).mockReturnValue({
      data: [billTarget],
      isLoading: false,
    } as unknown as ReturnType<typeof useBillTargets>);
    render(<BillPage />);
    fireEvent.click(screen.getByRole("button", { name: /A4 관리비 고지서/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /건물 선택/ }), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "1001 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "카톡 고지서 발송" }));

    await waitFor(() => expect(h.modal.onSent).toBeTypeOf("function"));
    await act(async () => {
      await h.modal.onSent?.({
        status: "queued",
        logId: 42,
        scheduledAt: null,
        recipients: [{ ref: { unitId: 101 } }],
      });
    });

    expect(h.recordMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        issueType: "kakao",
        sendStatus: "queued",
        messageLogId: 42,
        messageScheduleId: null,
      }),
    );
  });

  it("건물 선택 후 확정 세대 없으면 빈 안내", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { role: "staff", orgId: 1, permissions: ["bill_publish"] },
    } as unknown as ReturnType<typeof useMe>);
    vi.mocked(useBillTargets).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useBillTargets>);
    render(<BillPage />);
    fireEvent.click(screen.getByRole("button", { name: /A4 관리비 고지서/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /건물 선택/ }), {
      target: { value: "7" },
    });
    expect(
      screen.getByText(/부과 확정된 세대가 없습니다/),
    ).toBeInTheDocument();
  });

  it("선택 세대별 고지서 변수와 공개 상세 링크를 채워 알림톡을 완전히 렌더한다", async () => {
    vi.mocked(useMe).mockReturnValue({
      data: { role: "staff", orgId: 1, permissions: ["bill_publish"] },
    } as unknown as ReturnType<typeof useMe>);
    vi.mocked(useBillTargets).mockReturnValue({
      data: [billTarget],
      isLoading: false,
    } as unknown as ReturnType<typeof useBillTargets>);

    render(<BillPage />);
    fireEvent.click(screen.getByRole("button", { name: /A4 관리비 고지서/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /건물 선택/ }), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "1001 선택" }));
    expect(h.modal.preset).toBeUndefined();

    fireEvent.change(screen.getByLabelText("납기일"), {
      target: { value: "2026-09-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "카톡 고지서 발송" }));

    await waitFor(() => expect(h.modal.open).toBe(true));

    const preset = h.modal.preset;
    expect(preset).toMatchObject({
      buildingId: 7,
      channel: "alimtalk",
      mode: "alimtalk",
      templateTitle: "관리비 고지서",
      commonVariables: {
        건물명: "행복빌라",
        관리사무소연락처: "02-1234-5678",
      },
    });
    expect(preset?.recipients).toHaveLength(2);
    expect(preset?.recipients?.map((recipient) => recipient.variables)).toEqual([
      {
        세대: "101동 1001호",
        청구월: expect.stringMatching(/^\d{4}년 \d{1,2}월$/),
        청구금액: "120,000",
        납기일: "2026-09-05",
        납부계좌: "국민은행 123-456-789",
        상세링크: "https://resident.example.com/r/bill-token-101",
      },
      {
        세대: "101동 1001호",
        청구월: expect.stringMatching(/^\d{4}년 \d{1,2}월$/),
        청구금액: "120,000",
        납기일: "2026-09-05",
        납부계좌: "국민은행 123-456-789",
        상세링크: "https://resident.example.com/r/bill-token-101",
      },
    ]);
    expect(h.mintMutateAsync).toHaveBeenCalledWith({
      unitIds: [101],
      period: expect.stringMatching(/^\d{4}-\d{2}-01$/),
    });

    const templates = [{
      id: 301,
      title: "관리비 고지서",
      body: "[#{건물명}] #{청구월} 관리비 고지서\n#{세대} #{청구금액}원 #{납기일} #{납부계좌}\n문의: #{관리사무소연락처}",
    }];
    const template = templates.find(({ title }) => title === preset?.templateTitle);
    expect(template?.id).toBe(301);
    const renderedBodies = preset?.recipients?.map((recipient) =>
      renderTemplate(
        template?.body ?? "",
        buildRecipientRenderVariables(
          recipient,
          preset.commonVariables,
          "행복빌라",
        ),
      ),
    ) ?? [];
    expect(renderedBodies).toHaveLength(2);
    expect(renderedBodies.every((body) => !body.includes("#{"))).toBe(true);
    const renderedButtonUrls = preset?.recipients?.map((recipient) =>
      renderTemplate(
        "#{상세링크}",
        buildRecipientRenderVariables(
          recipient,
          preset.commonVariables,
          "행복빌라",
        ),
      ),
    ) ?? [];
    expect(renderedButtonUrls).toEqual([
      "https://resident.example.com/r/bill-token-101",
      "https://resident.example.com/r/bill-token-101",
    ]);
    expect(renderedButtonUrls.every((url) => !url.includes("#{"))).toBe(true);
  });

  it("고지서 토큰 발급 실패 시 오류를 알리고 발송 모달을 열지 않는다", async () => {
    h.mintMutateAsync.mockRejectedValueOnce(new Error("고지서 토큰 발급 실패"));
    vi.mocked(useMe).mockReturnValue({
      data: { role: "staff", orgId: 1, permissions: ["bill_publish"] },
    } as unknown as ReturnType<typeof useMe>);
    vi.mocked(useBillTargets).mockReturnValue({
      data: [billTarget],
      isLoading: false,
    } as unknown as ReturnType<typeof useBillTargets>);

    render(<BillPage />);
    fireEvent.click(screen.getByRole("button", { name: /A4 관리비 고지서/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /건물 선택/ }), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "1001 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "카톡 고지서 발송" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("고지서 토큰 발급 실패"),
    );
    expect(h.modal.open).toBe(false);
  });
});
