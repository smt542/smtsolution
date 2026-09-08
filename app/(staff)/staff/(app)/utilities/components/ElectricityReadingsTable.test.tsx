import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElectricityReadingsTable } from "./ElectricityReadingsTable";

const baseRow = {
  unitId: 1,
  unitNo: "101호",
  dong: null,
  occupancyId: 10,
  tenantName: "홍길동",
  occupancyStatus: "occupied" as const,
  moveInDate: "2026-07-01",
  customerNumber: "E-1",
  meterNumber: null,
  previousReading: 472,
  currentReading: 488,
  usage: 16,
  unitPrice: 49.3,
  resolvedUnitPrice: 49.3,
  automaticCharge: 790,
  manualCharge: null,
  note: null,
  processedAt: null,
  discountType: null,
  discountAmount: null,
};

describe("ElectricityReadingsTable", () => {
  it("조회 상태에서 Figma 열과 상태 범례를 표시한다", () => {
    render(
      <ElectricityReadingsTable
        rows={[baseRow]}
        drafts={{ 1: { currentReading: "488", manualCharge: "", note: "" } }}
        referenceDate="2026-07-15"
        editing={false}
        onDraftChange={vi.fn()}
      />,
    );
    expect(screen.getByText("호실별 전기 지침")).toBeInTheDocument();
    expect(screen.getByText("퇴실 예정")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "수동입력" })).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
  });

  it("전월·금월·량의 빈값 표기를 짧은 하이픈으로 통일한다", () => {
    render(
      <ElectricityReadingsTable
        rows={[{ ...baseRow, previousReading: null, currentReading: null, usage: null }]}
        drafts={{ 1: { currentReading: "", manualCharge: "", note: "" } }}
        referenceDate="2026-07-15"
        editing={false}
        onDraftChange={vi.fn()}
      />,
    );

    const cells = screen.getAllByRole("cell");
    expect(cells.slice(4, 7).map((cell) => cell.textContent)).toEqual(["-", "-", "-"]);
  });

  it("수정 상태에서 당월·수동요금·적요 변경을 전달한다", () => {
    const onDraftChange = vi.fn();
    render(
      <ElectricityReadingsTable
        rows={[baseRow]}
        drafts={{ 1: { currentReading: "488", manualCharge: "", note: "" } }}
        referenceDate="2026-07-15"
        editing
        onDraftChange={onDraftChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("101호 당월 지침값"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("101호 수동 입력 요금"), { target: { value: "900" } });
    fireEvent.change(screen.getByLabelText("101호 적요"), { target: { value: "확인" } });
    expect(onDraftChange).toHaveBeenNthCalledWith(1, 1, { currentReading: "500" });
    expect(onDraftChange).toHaveBeenNthCalledWith(2, 1, { manualCharge: "900" });
    expect(onDraftChange).toHaveBeenNthCalledWith(3, 1, { note: "확인" });
  });

  it("공실 사용량도 Figma 수정 상태에서 당월 입력을 허용한다", () => {
    const onDraftChange = vi.fn();
    render(
      <ElectricityReadingsTable
        rows={[{ ...baseRow, occupancyId: null, occupancyStatus: "vacant" }]}
        drafts={{ 1: { currentReading: "", manualCharge: "", note: "" } }}
        referenceDate="2026-07-15"
        editing
        onDraftChange={onDraftChange}
      />,
    );
    const input = screen.getByLabelText("101호 당월 지침값");
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: "12" } });
    expect(onDraftChange).toHaveBeenCalledWith(1, { currentReading: "12" });
    expect(screen.getAllByAltText("잠금")).toHaveLength(2);
  });

  it("수정 상태의 빈 전월·금월·량 입력에도 같은 하이픈을 표시한다", () => {
    render(
      <ElectricityReadingsTable
        rows={[{ ...baseRow, previousReading: null, currentReading: null, usage: null }]}
        drafts={{ 1: { currentReading: "", manualCharge: "", note: "" } }}
        referenceDate="2026-07-15"
        editing
        onDraftChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("101호 전월 지침값")).toHaveAttribute("placeholder", "-");
    expect(screen.getByLabelText("101호 당월 지침값")).toHaveAttribute("placeholder", "-");
    expect(screen.getByLabelText("101호 사용량")).toHaveAttribute("placeholder", "-");
  });

  it.each([
    ["서버 검토 플래그", { ...baseRow, needsReview: true }, "488", false],
    ["수정 중 음수 사용량", baseRow, "400", true],
  ])("%s가 있으면 확인 필요를 표시한다", (_case, row, currentReading, editing) => {
    render(
      <ElectricityReadingsTable
        rows={[row]}
        drafts={{ 1: { currentReading, manualCharge: "", note: "" } }}
        referenceDate="2026-07-15"
        editing={editing}
        onDraftChange={vi.fn()}
      />,
    );

    expect(screen.getByText("확인 필요")).toHaveClass("text-red");
  });

  it("조회 리스트의 모든 빈값을 같은 하이픈 스타일로 표시한다", () => {
    render(
      <ElectricityReadingsTable
        rows={[{
          ...baseRow,
          moveInDate: null,
          tenantName: null,
          customerNumber: null,
          previousReading: null,
          currentReading: null,
          usage: null,
          automaticCharge: null,
          manualCharge: null,
          note: null,
          processedAt: null,
          discountType: null,
          discountAmount: null,
        }]}
        drafts={{ 1: { currentReading: "", manualCharge: "", note: "" } }}
        referenceDate="2026-07-15"
        editing={false}
        onDraftChange={vi.fn()}
      />,
    );

    const emptyValues = screen.getAllByText("-");
    expect(emptyValues.length).toBeGreaterThan(10);
    emptyValues.forEach((value) => expect(value).toHaveClass("font-medium", "text-t3"));
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
