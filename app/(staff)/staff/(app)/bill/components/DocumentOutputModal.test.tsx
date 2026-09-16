import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendFax, recordDelivery, useQueries, issueBills } = vi.hoisted(() => ({
  sendFax: vi.fn(),
  recordDelivery: vi.fn(),
  useQueries: vi.fn(),
  issueBills: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({ useQueries }));
vi.mock("@/hooks/reactquery/bill", () => ({
  billKeys: {
    targets: (buildingId: number, period: string) => ["bill", "targets", buildingId, period],
    documents: (buildingId: number, period: string, unitIds: number[]) => ["bill", "documents", buildingId, period, unitIds],
  },
  listBillTargets: vi.fn(),
  getBillDocuments: vi.fn(),
  useIssueBills: () => ({ mutateAsync: issueBills, isPending: false }),
  useSendBillFaxes: () => ({ mutateAsync: sendFax, isPending: false }),
  useRecordBillDelivery: () => ({ mutateAsync: recordDelivery, isPending: false }),
}));
vi.mock("@/hooks/reactquery/billing", () => ({
  billingKeys: { periodSetting: (buildingId: number, period: string) => ["billing", buildingId, period] },
  getBillingPeriodSetting: vi.fn(),
}));
vi.mock("@/hooks/reactquery/payments", () => ({ cmsDownloadUrl: vi.fn(() => "/cms") }));
vi.mock("@/hooks/common/useAppToast", () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { appToast as toast } from "@/hooks/common/useAppToast";
import { DocumentOutputModal } from "./DocumentOutputModal";

const target = {
  unitId: 11,
  unitNo: "101",
  dong: null,
  occupancyId: 21,
  tenantName: "홍길동",
  payerName: "홍길동",
  payerNo: null,
  billNameDisplay: "name" as const,
  phone: "010-1000-0000",
  secondaryPhone: null,
  faxNumber: "02-1234-5678",
  totalAmount: 30000,
  autoDebit: false,
  issueType: null,
  dueDate: null,
  sendStatus: null,
  issuedAt: null,
  singlePrint: false,
  waterCutoff: false,
  scheduledAt: null,
  messageScheduleId: null,
  kakaoSendStatus: null,
  faxSendStatus: null,
};

const document = {
  unitId: 11,
  unitNo: "101",
  dong: null,
  tenantName: "홍길동",
  totalAmount: 30000,
  autoDebit: false,
  items: [{ feeItemId: 1, name: "관리비", charged: true, amount: 30000 }],
  billingNote: null,
  unitNotice: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  sendFax.mockResolvedValue({ queued: 1, failed: 0 });
  useQueries.mockImplementation(({ queries }: { queries: { queryKey: unknown[]; enabled?: boolean }[] }) =>
    queries.map((query) => ({
      data: query.queryKey[1] === "targets" ? [target] : query.queryKey[1] === "documents" ? [document] : [],
      isLoading: false,
      isFetching: false,
      isError: false,
    })),
  );
});

describe("DocumentOutputModal 팩스", () => {
  it("팩스번호가 등록된 선택 세대를 접수하고 결과 확인 중 토스트를 표시", async () => {
    render(
      <DocumentOutputModal
        type="fax"
        buildings={[{
          id: 7, code: "B007", name: "행복빌라", address: null,
        }]}
        companyName="한빛관리"
        accounts={[]}
        customerNotice={null}
        onClose={() => {}}
      />,
    );

    const openConfirm = screen.getByRole("button", { name: "발송" });
    await waitFor(() => expect(openConfirm).toBeEnabled());
    fireEvent.click(openConfirm);
    const dialogs = screen.getAllByRole("dialog");
    fireEvent.click(within(dialogs[1]).getByRole("button", { name: "발송" }));

    await waitFor(() => expect(sendFax).toHaveBeenCalledWith({
      buildingId: 7,
      period: expect.stringMatching(/^2026-\d{2}-01$/),
      unitIds: [11],
    }));
    expect(toast.success).toHaveBeenCalledWith("발송을 접수했습니다. 결과 확인 중입니다.");
  });
});

describe("DocumentOutputModal 지로 선택 상태", () => {
  const props = {
    buildings: [{ id: 7, code: "B007", name: "행복빌라", address: "서울시 마포구" }],
    companyName: "한빛관리",
    accounts: [],
    customerNotice: null,
    onClose: () => {},
  };

  it("건물 미선택 상태에서는 호수와 미리보기를 비우고 인쇄를 막는다", () => {
    render(<DocumentOutputModal type="giro" {...props} />);
    expect(screen.getByText("출력할 건물을 선택해 주세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "인쇄" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "건물 전체 선택" })).not.toBeChecked();
  });

  it("건물과 호수를 순서대로 선택하면 미리보기와 스탬프 범위를 활성화한다", async () => {
    render(<DocumentOutputModal type="giro" {...props} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "행복빌라 선택" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /행복빌라 · 101호/ })).toBeInTheDocument());
    expect(screen.getByText("출력할 호수를 선택해 주세요")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /행복빌라 · 101호/ }));
    await waitFor(() => expect(screen.getAllByText(/30,000/).length).toBeGreaterThan(0));
    const reissue = screen.getByRole("button", { name: "재발행" });
    expect(reissue).toBeEnabled();
    fireEvent.click(reissue);
    expect(reissue).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "자동이체" }));
    expect(screen.getByTestId("giro-stamp-auto-transfer")).toHaveTextContent("자동이체");
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(screen.getByText("스탬프 · 전체")).toBeInTheDocument();
  });
});
