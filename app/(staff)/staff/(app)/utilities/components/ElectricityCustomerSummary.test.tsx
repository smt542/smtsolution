import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElectricityCustomerSummary } from "./ElectricityCustomerSummary";

const row = {
  id: 11,
  customerNumber: "1000007919",
  billedAmount: 9968,
  chargeAmount: 5280,
  usage: 202,
  unitPrice: 49.3,
  currentReading: 202,
  previousReading: 206,
  meterDifference: -4688,
  movingCharge: 0,
};

describe("ElectricityCustomerSummary", () => {
  it("Figma 수정 상태에서 고객번호와 부과액을 텍스트박스로 편집한다", () => {
    const onDraftChange = vi.fn();
    render(
      <ElectricityCustomerSummary
        rows={[row]}
        drafts={{ 11: { customerNumber: row.customerNumber, chargeAmount: "5280" } }}
        editing
        onDraftChange={onDraftChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("1번 고객번호"), { target: { value: "1000112648" } });
    fireEvent.change(screen.getByLabelText("1000007919 부과액"), { target: { value: "3240" } });

    expect(onDraftChange).toHaveBeenNthCalledWith(1, 11, { customerNumber: "1000112648" });
    expect(onDraftChange).toHaveBeenNthCalledWith(2, 11, { chargeAmount: "3240" });
  });

  it("조회 상태에서는 Figma처럼 일반 셀 값으로 표시한다", () => {
    render(
      <ElectricityCustomerSummary
        rows={[row]}
        drafts={{}}
        editing={false}
        onDraftChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "1번 고객번호" })).not.toBeInTheDocument();
    expect(screen.getByText("1000007919")).toBeInTheDocument();
    expect(screen.getByText("9,968")).toBeInTheDocument();
    expect(screen.getByText("5,280")).toBeInTheDocument();
  });

  it("단가와 이사 빈값을 하단 그리드와 같은 하이픈 스타일로 표시한다", () => {
    render(
      <ElectricityCustomerSummary
        rows={[{ ...row, unitPrice: null }]}
        drafts={{}}
        editing={false}
        onDraftChange={vi.fn()}
      />,
    );

    const emptyValues = screen.getAllByText("-");
    expect(emptyValues).toHaveLength(2);
    emptyValues.forEach((value) => expect(value).toHaveClass("font-medium", "text-t3"));
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
