// app/(staff)/staff/bill/page.test.tsx
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  recordMutateAsync: vi.fn(),
  modal: { onSent: null as null | ((result: unknown) => void | Promise<void>) },
}));

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildings: () => ({ data: [{ id: 7, orgId: 1, code: "B007", name: "행복빌라", address: "서울시" }], isLoading: false }),
}));
vi.mock("@/hooks/reactquery/setupConfig", () => ({
  useSetupConfig: () => ({
    data: { unitLabelDefault: "code", mgmtPrint1: false, mgmtPrint2: false },
  }),
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
vi.mock(
  "@/app/(staff)/staff/messaging/components/MessagingModal",
  () => ({
    MessagingModal: (props: { onSent?: (result: unknown) => void | Promise<void> }) => {
      h.modal.onSent = props.onSent ?? null;
      return null;
    },
  }),
);

import BillPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillTargets } from "@/hooks/reactquery/bill";

beforeEach(() => vi.clearAllMocks());

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
    render(<BillPage />);
    fireEvent.click(screen.getByRole("button", { name: /A4 관리비 고지서/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /건물 선택/ }), {
      target: { value: "7" },
    });

    expect(h.modal.onSent).toBeTypeOf("function");
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
});
