import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSettlementList: vi.fn(),
}));

import { useSettlementList } from "@/hooks/reactquery/movingSettlement";
import { SettlementHistory } from "./SettlementHistory";

describe("SettlementHistory", () => {
  it("날짜범위 조회 결과를 표시한다", () => {
    vi.mocked(useSettlementList).mockReturnValue({
      data: [
        {
          settlementId: 31,
          unitId: 101,
          occupancyId: 9,
          unitNo: "101호",
          tenantName: "홍길동",
          status: "completed",
          settlementAmount: 218806,
          moveOutDate: "2026-08-13",
          processedAt: "2026-08-13T03:00:00Z",
          createdAt: "2026-08-13T01:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    } as never);

    render(<SettlementHistory buildingId={3} />);

    expect(screen.getByText("101호")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("정산완료")).toBeInTheDocument();
    expect(screen.getByText("218,806원")).toBeInTheDocument();
  });
});
