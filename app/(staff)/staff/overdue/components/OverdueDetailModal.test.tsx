import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OverdueHousehold } from "@/hooks/reactquery/overdue";
import { OverdueDetailModal } from "./OverdueDetailModal";

const household = {
  occupancyId: 1,
  unitId: 1,
  buildingId: 1,
  buildingName: "그린빌라",
  unitNo: "101호",
  dong: "A동",
  status: "occupied",
  overdueMonths: 3,
  overdueAmount: 100_000,
  lastPaymentDate: null,
  billingAvailable: true,
  lateFeeAmount: 3_400,
  lateFeeByPeriod: [
    {
      period: "2026-03-01",
      months: 3,
      cumulativeRatePct: 3.4,
      lateFee: 3_400,
    },
  ],
} as OverdueHousehold;

describe("OverdueDetailModal", () => {
  it("월분별 연체료 내역과 합계를 렌더한다", () => {
    render(<OverdueDetailModal household={household} onClose={vi.fn()} />);

    expect(screen.getByText("연체료 내역")).toBeInTheDocument();
    expect(screen.getByText("2026-03")).toBeInTheDocument();
    expect(screen.getByText("3개월", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("3.4%")).toBeInTheDocument();
    expect(screen.getAllByText("3,400원")).toHaveLength(2);
  });
});
