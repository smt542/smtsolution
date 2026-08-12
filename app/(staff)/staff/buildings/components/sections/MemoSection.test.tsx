import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoSection } from "./MemoSection";

describe("MemoSection", () => {
  it("입력 → onChange + 잔여 글자수", () => {
    const onChange = vi.fn();
    render(<MemoSection value="안녕" onChange={onChange} />);
    expect(screen.getByText("2 / 1000")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("참고사항"), { target: { value: "메모" } });
    expect(onChange).toHaveBeenCalledWith("메모");
  });
  it("1000자 초과 입력은 잘림", () => {
    const onChange = vi.fn();
    render(<MemoSection value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("참고사항"), { target: { value: "가".repeat(1005) } });
    expect((onChange.mock.calls[0][0] as string).length).toBe(1000);
  });
});
