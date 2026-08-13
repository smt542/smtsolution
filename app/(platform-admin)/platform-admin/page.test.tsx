import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import PlatformDashboardPage from "./page";

const hooks = vi.hoisted(() => ({
  usePlatformOverview: vi.fn(),
  usePlatformOrganizations: vi.fn(),
  usePlatformTransactions: vi.fn(),
}));

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformOverview: hooks.usePlatformOverview,
  usePlatformOrganizations: hooks.usePlatformOrganizations,
  usePlatformTransactions: hooks.usePlatformTransactions,
}));

const organizations = [
  { id: 1, name: "한빛", pointBalance: 700, status: "active", slug: null, createdAt: "", accountCount: 0, buildingCount: 0 },
  { id: 2, name: "새봄", pointBalance: 500, status: "trial", slug: null, createdAt: "", accountCount: 0, buildingCount: 0 },
];
const transactions = [
  { id: 9, orgId: 1, organizationName: "한빛", type: "charge", points: 1000, amountKrw: 110000, memo: null, createdBy: null, createdByName: null, createdAt: "2026-08-02T00:00:00Z" },
];

let organizationsRefetch: ReturnType<typeof vi.fn>;
let transactionsRefetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  organizationsRefetch = vi.fn();
  transactionsRefetch = vi.fn();
  hooks.usePlatformOverview.mockReturnValue({
    data: { activeOrganizationCount: 2, accountCount: 5, buildingCount: 3 },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  });
  hooks.usePlatformOrganizations.mockReturnValue({
    data: organizations,
    isPending: false,
    isError: false,
    refetch: organizationsRefetch,
  });
  hooks.usePlatformTransactions.mockReturnValue({
    data: transactions,
    isPending: false,
    isError: false,
    refetch: transactionsRefetch,
  });
});

describe("PlatformDashboardPage", () => {
  it("안정된 데이터에서 활성 조직, 총 포인트 잔액과 최근 충전을 표시한다", () => {
    render(<PlatformDashboardPage />);

    expect(screen.getByRole("heading", { name: "플랫폼 운영 현황" })).toBeInTheDocument();
    expect(screen.getByText("활성 조직")).toBeInTheDocument();
    expect(screen.getByText(/1,200/)).toBeInTheDocument();
    expect(screen.getByText("한빛")).toBeInTheDocument();
    expect(screen.getByText("+1,000 P")).toBeInTheDocument();
  });

  it("조직 쿼리 pending 중에는 잔액 0 대신 로딩 UI를 표시한다", () => {
    hooks.usePlatformOrganizations.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: organizationsRefetch,
    });

    render(<PlatformDashboardPage />);

    const balanceCard = screen.getByLabelText("총 포인트 잔액");
    expect(within(balanceCard).getByRole("status", { name: "조직 포인트 잔액을 불러오는 중" })).toBeInTheDocument();
    expect(within(balanceCard).queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("한빛")).toBeInTheDocument();
  });

  it("조직 쿼리 error에서 오류 UI를 표시하고 다시 시도한다", () => {
    hooks.usePlatformOrganizations.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: organizationsRefetch,
    });

    render(<PlatformDashboardPage />);

    const balanceCard = screen.getByLabelText("총 포인트 잔액");
    expect(within(balanceCard).getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(within(balanceCard).queryByText("0")).not.toBeInTheDocument();
    fireEvent.click(within(balanceCard).getByRole("button", { name: "다시 시도" }));
    expect(organizationsRefetch).toHaveBeenCalledTimes(1);
  });

  it("최근 충전 쿼리 pending 중에는 빈 내역 대신 로딩 UI를 표시한다", () => {
    hooks.usePlatformTransactions.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: transactionsRefetch,
    });

    render(<PlatformDashboardPage />);

    const recentSection = screen.getByRole("region", { name: "최근 충전" });
    expect(within(recentSection).getByRole("status", { name: "최근 충전 내역을 불러오는 중" })).toBeInTheDocument();
    expect(within(recentSection).queryByText("최근 충전 내역이 없습니다.")).not.toBeInTheDocument();
    expect(screen.getByText(/1,200/)).toBeInTheDocument();
  });

  it("최근 충전 쿼리 error에서 오류 UI를 표시하고 다시 시도한다", () => {
    hooks.usePlatformTransactions.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: transactionsRefetch,
    });

    render(<PlatformDashboardPage />);

    const recentSection = screen.getByRole("region", { name: "최근 충전" });
    expect(within(recentSection).getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(within(recentSection).queryByText("최근 충전 내역이 없습니다.")).not.toBeInTheDocument();
    fireEvent.click(within(recentSection).getByRole("button", { name: "다시 시도" }));
    expect(transactionsRefetch).toHaveBeenCalledTimes(1);
  });
});
