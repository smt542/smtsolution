import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlatformDashboardPage from "./page";

const hooks = vi.hoisted(() => ({
  usePlatformOverviewMetrics: vi.fn(),
  usePlatformOrgBilling: vi.fn(),
}));

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformOverviewMetrics: hooks.usePlatformOverviewMetrics,
  usePlatformOrgBilling: hooks.usePlatformOrgBilling,
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
  { orgId: 1, orgName: "한빛관리", orgEmail: "a@x.kr", status: "unpaid", alimtalkCount: 120, smsCount: 30, faxCount: 4, subtotalKrw: 20000, vatKrw: 2000, totalKrw: 22000, prevTotalKrw: 18000 },
  { orgId: 2, orgName: "새봄관리", orgEmail: null, status: "none", alimtalkCount: 0, smsCount: 0, faxCount: 0, subtotalKrw: 0, vatKrw: 0, totalKrw: 0, prevTotalKrw: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  hooks.usePlatformOverviewMetrics.mockReturnValue({ data: metrics, isPending: false, isError: false, refetch: vi.fn() });
  hooks.usePlatformOrgBilling.mockReturnValue({ data: billingRows, isPending: false, isError: false, refetch: vi.fn() });
});

describe("PlatformDashboardPage", () => {
  it("HQ 핵심 지표와 테넌트별 발송 비용을 표시한다", () => {
    render(<PlatformDashboardPage />);

    expect(screen.getByRole("heading", { name: "대시보드" })).toBeInTheDocument();
    expect(screen.getByText("29곳")).toBeInTheDocument();
    expect(screen.getByText("정지 2 · 해지 1")).toBeInTheDocument();
    expect(screen.getByText("612곳")).toBeInTheDocument();
    expect(screen.getByText("앱 연결 8,860세대 (71%)")).toBeInTheDocument();
    expect(screen.getByText("589,490원")).toBeInTheDocument();
    // 발송 실적이 있는 테넌트만 표에 노출
    expect(screen.getByText("한빛관리")).toBeInTheDocument();
    expect(screen.queryByText("새봄관리")).not.toBeInTheDocument();
  });

  it("지표 로딩 중에는 스피너를 표시한다", () => {
    hooks.usePlatformOverviewMetrics.mockReturnValue({ data: undefined, isPending: true, isError: false, refetch: vi.fn() });
    render(<PlatformDashboardPage />);
    expect(screen.queryByText("29곳")).not.toBeInTheDocument();
  });

  it("지표 오류 시 오류 UI와 다시 시도를 제공한다", () => {
    const refetch = vi.fn();
    hooks.usePlatformOverviewMetrics.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch });
    render(<PlatformDashboardPage />);
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();
  });
});
