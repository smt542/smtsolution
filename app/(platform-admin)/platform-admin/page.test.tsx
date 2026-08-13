import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlatformDashboardPage from "./page";

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformOverview: () => ({ data: { organizationCount: 2, accountCount: 5, buildingCount: 3 }, isPending: false, isError: false, refetch: vi.fn() }),
  usePlatformOrganizations: () => ({ data: [{ id: 1, name: "한빛", pointBalance: 700, status: "active", slug: null, createdAt: "", accountCount: 0, buildingCount: 0 }, { id: 2, name: "새봄", pointBalance: 500, status: "trial", slug: null, createdAt: "", accountCount: 0, buildingCount: 0 }] }),
  usePlatformTransactions: () => ({ data: [{ id: 9, orgId: 1, organizationName: "한빛", type: "charge", points: 1000, amountKrw: 110000, memo: null, createdBy: null, createdByName: null, createdAt: "2026-08-02T00:00:00Z" }] }),
}));

it("총 포인트 잔액(1,200)과 최근 충전을 표시한다", () => {
  render(<PlatformDashboardPage />);
  expect(screen.getByText(/1,200/)).toBeInTheDocument();
  expect(screen.getByText("한빛")).toBeInTheDocument();
});
