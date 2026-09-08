import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/billing", () => ({ useBillingHistory: vi.fn() }));
import { BillingHistoryModal } from "./BillingHistoryModal";
import { useBillingHistory } from "@/hooks/reactquery/billing";
beforeEach(() => vi.clearAllMocks());

describe("BillingHistoryModal", () => {
  it("기간별 총액과 전월대비 증감 표시", () => {
    vi.mocked(useBillingHistory).mockReturnValue({ data: [
      { period: "2026-08-01", totalAmount: 90000, items: [], confirmedAt: "x" },
      { period: "2026-07-01", totalAmount: 80000, items: [], confirmedAt: "y" },
    ], isLoading: false } as never);
    render(<BillingHistoryModal open unitId={1} unitNo="101" period="2026-08-01" onClose={vi.fn()} />);
    expect(screen.getByText("90,000")).toBeInTheDocument();
    expect(screen.getByText(/\+10,000/)).toBeInTheDocument(); // 전월대비 증가
  });
  it("open=false면 렌더 안 함", () => {
    vi.mocked(useBillingHistory).mockReturnValue({ data: [], isLoading: false } as never);
    const { container } = render(<BillingHistoryModal open={false} unitId={1} unitNo="101" period="2026-08-01" onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
