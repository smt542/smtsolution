import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlatformDashboardPage from "./page";

const hooks = vi.hoisted(() => ({
  usePlatformOverviewMetrics: vi.fn(),
  usePlatformOrgBilling: vi.fn(),
  usePlatformMonthlySendCost: vi.fn(),
  usePlatformSettings: vi.fn(),
}));

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformOverviewMetrics: hooks.usePlatformOverviewMetrics,
  usePlatformOrgBilling: hooks.usePlatformOrgBilling,
  usePlatformMonthlySendCost: hooks.usePlatformMonthlySendCost,
  usePlatformSettings: hooks.usePlatformSettings,
}));

const metrics = {
  orgActive: 29,
  orgSuspended: 2,
  orgTerminated: 1,
  buildingCount: 612,
  buildingAddedThisMonth: 14,
  unitCount: 12480,
  linkedUnitCount: 8860,
  sendCostKrw: 589490,
  sendCostPrevKrw: 556000,
};

const billingRows = [
  { orgId: 1, orgName: "한빛관리", orgEmail: "a@x.kr", status: "unpaid", alimtalkCount: 120, smsCount: 30, lmsCount: 2, faxCount: 4, faxPageCount: 6, alimtalkAmountKrw: 1200, smsAmountKrw: 660, faxAmountKrw: 300, subtotalKrw: 2160, vatKrw: 216, totalKrw: 2376, prevTotalKrw: 1800 },
  { orgId: 2, orgName: "새봄관리", orgEmail: null, status: "none", alimtalkCount: 0, smsCount: 0, lmsCount: 0, faxCount: 0, faxPageCount: 0, alimtalkAmountKrw: 0, smsAmountKrw: 0, faxAmountKrw: 0, subtotalKrw: 0, vatKrw: 0, totalKrw: 0, prevTotalKrw: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  hooks.usePlatformOverviewMetrics.mockReturnValue({ data: metrics, isPending: false, isError: false, refetch: vi.fn() });
  hooks.usePlatformOrgBilling.mockReturnValue({ data: billingRows, isPending: false, isError: false, refetch: vi.fn() });
  hooks.usePlatformMonthlySendCost.mockReturnValue({
    data: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      alimtalkKrw: index < 8 ? 1000 : 0,
      smsKrw: index < 8 ? 200 : 0,
      faxKrw: index < 8 ? 100 : 0,
    })),
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  });
  hooks.usePlatformSettings.mockReturnValue({
    data: { rateKrwAlimtalk: 10, rateKrwSms: 20, rateKrwLms: 30, rateKrwFax: 50 },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  });
});

describe("PlatformDashboardPage", () => {
  it("HQ 핵심 지표와 테넌트별 발송 비용을 표시한다", () => {
    render(<PlatformDashboardPage />);

    expect(screen.getByRole("heading", { name: "대시보드" })).toBeInTheDocument();
    expect(screen.getByText("계약 업체").closest("article")).toHaveTextContent("29곳");
    expect(screen.getByText("정지 2 · 해지 1")).toBeInTheDocument();
    expect(screen.getByText("관리 건물").closest("article")).toHaveTextContent("612곳");
    expect(screen.getByText("앱 연결 8,860세대 (71%)")).toBeInTheDocument();
    expect(
      screen.getByText(`${new Date().getMonth() + 1}월 발송 비용`).closest("article"),
    ).toHaveTextContent("589,490원");
    expect(screen.getByRole("heading", { name: "알림톡 · 문자 · 팩스 발송 비용" })).toBeInTheDocument();
    expect(screen.getByText("8개월 · 월 평균 1,300원")).toBeInTheDocument();
    // 채널별 금액과 발송 0원 업체를 함께 표시
    expect(screen.getByText("한빛관리")).toBeInTheDocument();
    expect(screen.getByText("새봄관리")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(screen.getByText("660")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("전체 2곳")).toBeInTheDocument();
  });

  it("지표 로딩 중에는 스피너를 표시한다", () => {
    hooks.usePlatformOverviewMetrics.mockReturnValue({ data: undefined, isPending: true, isError: false, refetch: vi.fn() });
    render(<PlatformDashboardPage />);
    expect(screen.queryByText("계약 업체")).not.toBeInTheDocument();
  });

  it("지표 오류 시 오류 UI와 다시 시도를 제공한다", () => {
    const refetch = vi.fn();
    hooks.usePlatformOverviewMetrics.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch });
    render(<PlatformDashboardPage />);
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();
  });
});
