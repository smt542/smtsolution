import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PlatformBillingPage from "./page";

const hooks = vi.hoisted(() => ({
  usePlatformOrgBilling: vi.fn(),
  useMarkOrgBillingPaid: vi.fn(),
  usePlatformSettings: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformOrgBilling: hooks.usePlatformOrgBilling,
  useMarkOrgBillingPaid: hooks.useMarkOrgBillingPaid,
  usePlatformSettings: hooks.usePlatformSettings,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const rows = [
  { orgId: 1, orgName: "한빛관리", orgEmail: "a@x.kr", status: "unpaid", alimtalkCount: 120, smsCount: 30, lmsCount: 5, faxCount: 4, faxPageCount: 9, alimtalkAmountKrw: 1440, smsAmountKrw: 700, faxAmountKrw: 450, subtotalKrw: 20000, vatKrw: 2000, totalKrw: 22000, prevTotalKrw: 18000 },
  { orgId: 2, orgName: "새봄관리", orgEmail: "b@x.kr", status: "paid", alimtalkCount: 80, smsCount: 10, lmsCount: 0, faxCount: 0, faxPageCount: 0, alimtalkAmountKrw: 960, smsAmountKrw: 200, faxAmountKrw: 0, subtotalKrw: 15000, vatKrw: 1500, totalKrw: 16500, prevTotalKrw: 16500 },
  { orgId: 3, orgName: "가을관리", orgEmail: null, status: "none", alimtalkCount: 0, smsCount: 0, lmsCount: 0, faxCount: 0, faxPageCount: 0, alimtalkAmountKrw: 0, smsAmountKrw: 0, faxAmountKrw: 0, subtotalKrw: 0, vatKrw: 0, totalKrw: 0, prevTotalKrw: 0 },
];

const settings = {
  id: 1,
  rateKrwAlimtalk: 12,
  rateKrwSms: 20,
  rateKrwLms: 40,
  rateKrwFax: 50,
  lowBalanceThreshold: 0,
  billingBank: "농협은행",
  billingAccountNo: "301-0000-0000-01",
  billingAccountHolder: "주식회사 관리비서",
  businessRegNo: "305-81-00000",
  invoiceNotice: "입금 시 업체명으로 입금해 주세요.",
  billingBasis: null,
  paymentDueDays: 14,
  vatRate: 10,
  contactPerson: "최본사",
  updatedBy: null,
  updatedAt: "2026-08-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  hooks.mutateAsync.mockResolvedValue(null);
  hooks.usePlatformOrgBilling.mockReturnValue({ data: rows, isPending: false, isError: false, refetch: vi.fn() });
  hooks.useMarkOrgBillingPaid.mockReturnValue({ mutateAsync: hooks.mutateAsync, isPending: false });
  hooks.usePlatformSettings.mockReturnValue({ data: settings, isPending: false, isError: false });
});

describe("PlatformBillingPage", () => {
  it("테넌트별 청구액·상태를 표시한다", () => {
    render(<PlatformBillingPage />);
    // 제목(청구 관리)은 셸 상단바가 렌더 — 페이지 단위 테스트 범위 밖.
    expect(screen.getByText("한빛관리")).toBeInTheDocument();
    expect(screen.getByText("새봄관리")).toBeInTheDocument();
    expect(screen.getByText("20,000")).toBeInTheDocument();
    expect(screen.getByText("+22%")).toBeInTheDocument();
    expect(screen.getByText(/미입금 1곳 · 입금 완료 1곳/)).toBeInTheDocument();
    // 상태별 처리 버튼: 미입금→입금 확인, 입금완료→입금 취소, 청구 없음→버튼 없음
    expect(screen.getByRole("button", { name: "입금 확인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "입금 취소" })).toBeInTheDocument();
  });

  it("상태 탭으로 미입금만 거른다", () => {
    render(<PlatformBillingPage />);
    fireEvent.click(screen.getByRole("button", { name: "미입금" }));
    expect(screen.getByText("한빛관리")).toBeInTheDocument();
    expect(screen.queryByText("새봄관리")).not.toBeInTheDocument();
    expect(screen.queryByText("가을관리")).not.toBeInTheDocument();
  });

  it("입금 처리 버튼이 mark-paid를 호출한다", async () => {
    render(<PlatformBillingPage />);
    fireEvent.click(screen.getByRole("button", { name: "미입금" }));
    fireEvent.click(screen.getByRole("button", { name: "입금 확인" }));
    expect(hooks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 1, paid: true }),
    );
  });

  it("행 발행 버튼이 청구서 미리보기를 연다", () => {
    render(<PlatformBillingPage />);
    fireEvent.click(screen.getByRole("button", { name: "미입금" }));
    fireEvent.click(screen.getByRole("button", { name: "발행" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /한빛관리 발송비 청구서/ })).toBeInTheDocument();
    // 청구서 문서는 화면용 + 인쇄 전용 루트 두 곳에 렌더된다.
    expect(screen.getAllByText("발송비 청구서").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "청구서 다운로드" })).toBeInTheDocument();
  });

  it("헤더 전체 발행 버튼이 인쇄를 트리거한다", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    render(<PlatformBillingPage />);
    fireEvent.click(screen.getByRole("button", { name: "전체 발행" }));
    expect(printSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
    printSpy.mockRestore();
  });
});
