import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BillStatementSection } from "./BillStatementSection";

const base = { printEnabled: true, billNameDisplay: "name" as const, billDelivery: "post" as const, billAuth: false };

describe("BillStatementSection", () => {
  it("고지서 이름 출력과 발송 방식을 enum 값으로 변경한다", () => {
    const onChange = vi.fn();
    render(<BillStatementSection value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("이름 출력 유형"), { target: { value: "code" } });
    fireEvent.change(screen.getByLabelText("고지서 발송"), { target: { value: "alimtalk" } });
    expect(onChange).toHaveBeenCalledWith({ billNameDisplay: "code" });
    expect(onChange).toHaveBeenCalledWith({ billDelivery: "alimtalk" });
    expect(screen.getByText(/이체 방식과 무관하게/)).toBeInTheDocument();
  });
});
