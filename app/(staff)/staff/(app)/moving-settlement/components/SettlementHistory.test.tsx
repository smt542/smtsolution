import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSettlementInquiry: vi.fn(),
}));

import { useSettlementInquiry } from "@/hooks/reactquery/movingSettlement";
import { SettlementHistory } from "./SettlementHistory";

describe("SettlementHistory", () => {
  it("날짜 미선택 시 안내 문구를 표시한다", () => {
    vi.mocked(useSettlementInquiry).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as never);

    render(<SettlementHistory />);

    expect(screen.getByText("이사정산 이력 조회")).toBeInTheDocument();
    expect(screen.getByText(/날짜를 선택하면/)).toBeInTheDocument();
  });
});
