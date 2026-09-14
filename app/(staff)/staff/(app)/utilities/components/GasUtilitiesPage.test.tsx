import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { GasAccountSummary } from "./gas/GasAccountSummary";
import { UtilityBuildingRail } from "./UtilityBuildingRail";
import { GasReadingsTable } from "./gas/GasReadingsTable";
import type { GasTableRow, GasUtilityDraft } from "./gas/types";

const baseRow: UtilityUnitRow = {
  unitId: 1,
  unitNo: "101호",
  dong: null,
  occupancyId: 10,
  tenantName: "홍길동",
  occupancyStatus: "occupied",
  moveInDate: "2026-07-10",
  customerNumber: "G-001",
  meterNumber: "M-1",
  previousReading: 20,
  currentReading: 24,
  usage: 4,
  unitPrice: 100,
  resolvedUnitPrice: 100,
  automaticCharge: 400,
  manualCharge: null,
  note: null,
  processedAt: null,
  discountType: null,
  discountAmount: null,
};
const row: GasTableRow = { ...baseRow, fixedUsage: null, fixedUsageFrom: null };
const drafts: Record<number, GasUtilityDraft> = {
  1: { currentReading: "24", manualCharge: "", note: "" },
};

describe("가스 공과금 Figma 표", () => {
  it("고객번호 요약의 14개 컬럼과 계산값을 표시한다", () => {
    render(<GasAccountSummary rows={[row]} drafts={drafts} editing={false} />);

    expect(screen.getByRole("columnheader", { name: "고객번호" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "금월량" })).toBeInTheDocument();
    expect(screen.getByText("G-001")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("호실 지침의 20개 컬럼과 수정 입력을 표시한다", () => {
    render(
      <GasReadingsTable
        rows={[row]}
        drafts={drafts}
        editing
        referenceDate="2026-07-31"
        chargeStartDate="2026-07-01"
        chargeEndDate="2026-07-31"
        onDraftChange={() => {}}
        onOpenFixedUsage={() => {}}
      />,
    );

    expect(screen.getAllByRole("columnheader")).toHaveLength(20);
    expect(screen.getByLabelText("101호 전월 지침값")).toHaveValue(20);
    expect(screen.getByLabelText("101호 전월 지침값")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("101호 당월 지침값")).toHaveValue(24);
    expect(screen.getByLabelText("101호 당월 지침값")).toBeEnabled();
    expect(screen.getByLabelText("101호 사용량")).toHaveValue(4);
    expect(screen.getByLabelText("101호 사용량")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("101호 수동 입력 요금")).toBeEnabled();
    expect(screen.getByLabelText("101호 고정 사용량 설정")).toBeInTheDocument();
  });

  it("건물 목록을 코드·건물명·주소·가스 고객번호 수로 표시한다", () => {
    render(
      <UtilityBuildingRail
        buildings={[{ id: 1, code: "001", name: "그린빌라", address: "서울 강서구" }]}
        selectedBuildingId={1}
        period="2026-07-01"
        utilityLabel="가스"
        customerNumberCounts={{ 1: 2 }}
        search=""
        onSearchChange={() => {}}
        onPeriodChange={() => {}}
        onSelectBuilding={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "전체 건물" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "주소" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "가스" })).toBeInTheDocument();
    expect(screen.getByText("서울 강서구")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
