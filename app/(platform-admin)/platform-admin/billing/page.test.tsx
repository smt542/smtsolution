import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PlatformBillingPage from "./page";

const hooks = vi.hoisted(() => ({
  usePlatformOrgBilling: vi.fn(),
  useMarkOrgBillingPaid: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformOrgBilling: hooks.usePlatformOrgBilling,
  useMarkOrgBillingPaid: hooks.useMarkOrgBillingPaid,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const rows = [
  { orgId: 1, orgName: "한빛관리", orgEmail: "a@x.kr", status: "unpaid", alimtalkCount: 120, smsCount: 30, lmsCount: 5, faxCount: 4, faxPageCount: 9, subtotalKrw: 20000, vatKrw: 2000, totalKrw: 22000, prevTotalKrw: 18000 },
  { orgId: 2, orgName: "새봄관리", orgEmail: "b@x.kr", status: "paid", alimtalkCount: 80, smsCount: 10, lmsCount: 0, faxCount: 0, faxPageCount: 0, subtotalKrw: 15000, vatKrw: 1500, totalKrw: 16500, prevTotalKrw: 16500 },
  { orgId: 3, orgName: "가을관리", orgEmail: null, status: "none", alimtalkCount: 0, smsCount: 0, lmsCount: 0, faxCount: 0, faxPageCount: 0, subtotalKrw: 0, vatKrw: 0, totalKrw: 0, prevTotalKrw: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  hooks.mutateAsync.mockResolvedValue(null);
  hooks.usePlatformOrgBilling.mockReturnValue({ data: rows, isPending: false, isError: false, refetch: vi.fn() });
  hooks.useMarkOrgBillingPaid.mockReturnValue({ mutateAsync: hooks.mutateAsync, isPending: false });
});

describe("PlatformBillingPage", () => {
  it("테넌트별 청구액·상태를 표시한다", () => {
    render(<PlatformBillingPage />);
    expect(screen.getByRole("heading", { name: "청구 관리" })).toBeInTheDocument();
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
});
