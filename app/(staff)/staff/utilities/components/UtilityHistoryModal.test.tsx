import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/utilities", () => ({ useMeterHistory: vi.fn() }));
import { useMeterHistory } from "@/hooks/reactquery/utilities";
import { UtilityHistoryModal } from "./UtilityHistoryModal";

const row = { unitId: 101, unitNo: "101호", tenantName: "홍길동" } as never;

describe("UtilityHistoryModal", () => {
  it("meter_readings 이력의 부과액·전월 대비 증감을 표시한다", () => {
    vi.mocked(useMeterHistory).mockReturnValue({
      data: [
        { period: "2026-08-01", charge: 12000, unitPrice: null },
        { period: "2026-07-01", charge: 9000, unitPrice: null },
      ],
      isLoading: false,
      error: null,
    } as never);

    render(
      <UtilityHistoryModal
        open
        row={row}
        utilityType="water"
        referenceDate="2026-08-15"
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("101호 수도 6개월 이력")).toBeInTheDocument();
    expect(screen.getByText("12,000")).toBeInTheDocument();
    expect(screen.getByText("+3,000")).toBeInTheDocument();
  });

  it("이력이 없으면 안내 문구를 표시한다", () => {
    vi.mocked(useMeterHistory).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);

    render(
      <UtilityHistoryModal
        open
        row={row}
        utilityType="water"
        referenceDate="2026-08-15"
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("검침 이력이 없습니다.")).toBeInTheDocument();
  });
});
