import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendFax, recordDelivery, useQueries } = vi.hoisted(() => ({
  sendFax: vi.fn(),
  recordDelivery: vi.fn(),
  useQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({ useQueries }));
vi.mock("@/hooks/reactquery/bill", () => ({
  billKeys: {
    targets: (buildingId: number, period: string) => ["bill", "targets", buildingId, period],
    documents: (buildingId: number, period: string, unitIds: number[]) => ["bill", "documents", buildingId, period, unitIds],
  },
  listBillTargets: vi.fn(),
  getBillDocuments: vi.fn(),
  useIssueBills: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendBillFaxes: () => ({ mutateAsync: sendFax, isPending: false }),
  useRecordBillDelivery: () => ({ mutateAsync: recordDelivery, isPending: false }),
}));
vi.mock("@/hooks/reactquery/billing", () => ({
  billingKeys: { periodSetting: (buildingId: number, period: string) => ["billing", buildingId, period] },
  getBillingPeriodSetting: vi.fn(),
}));
vi.mock("@/hooks/reactquery/payments", () => ({ cmsDownloadUrl: vi.fn(() => "/cms") }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";
import { emptyFacilities } from "@/hooks/reactquery/buildings";
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

beforeEach(() => {
  vi.clearAllMocks();
  sendFax.mockResolvedValue({ queued: 1, failed: 0 });
  useQueries.mockImplementation(({ queries }: { queries: { queryKey: unknown[]; enabled?: boolean }[] }) =>
    queries.map((query) => ({
      data: query.queryKey[1] === "targets" ? [target] : [],
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
          id: 7, orgId: 1, code: "B007", name: "행복빌라", address: null,
          typeId: null, ownerName: null, ownerPhone: null, entrancePassword: null,
          managerUserId: null, meterUserId: null, cleaningUserId: null, facilities: emptyFacilities(), memo: null, billingNote: null,
          setupConfirmRequired: false,
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
