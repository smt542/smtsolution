import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlatformBillingPage from "./page";

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformTransactions: () => ({
    data: [
      { id: 1, orgId: 1, organizationName: "한빛관리", type: "charge", points: 1000, amountKrw: 110000, memo: null, createdBy: "u1", createdByName: "김운영", createdAt: "2026-08-02T00:00:00Z" },
    ],
    isPending: false, isError: false, refetch: vi.fn(),
  }),
}));

it("충전 결제 내역에 금액과 포인트를 표시한다", () => {
  render(<PlatformBillingPage />);
  expect(screen.getByText("한빛관리")).toBeInTheDocument();
  // 누적 결제액(헤더)과 표 행에 동일 금액이 각각 렌더된다
  expect(screen.getAllByText("110,000")).toHaveLength(2);
  expect(screen.getByText(/1,000/)).toBeInTheDocument();
  expect(screen.getByText("김운영")).toBeInTheDocument();
});
