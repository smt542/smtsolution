import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillingNoteModal } from "./BillingNoteModal";

describe("BillingNoteModal", () => {
  it("기존 값 표시 후 저장 시 onSave 호출", () => {
    const onSave = vi.fn();
    render(<BillingNoteModal open unitNo="101" billingNote="기존참조" unitNotice="" onClose={vi.fn()} onSave={onSave} />);
    const ref = screen.getByLabelText("부과 참조사항");
    fireEvent.change(ref, { target: { value: "수정참조" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith({ billingNote: "수정참조", unitNotice: "" });
  });
  it("open=false면 렌더 안 함", () => {
    const { container } = render(<BillingNoteModal open={false} unitNo="101" billingNote="" unitNotice="" onClose={vi.fn()} onSave={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
