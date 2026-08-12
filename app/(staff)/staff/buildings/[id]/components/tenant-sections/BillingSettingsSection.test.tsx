// app/(staff)/staff/buildings/[id]/components/tenant-sections/BillingSettingsSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillingSettingsSection } from "./BillingSettingsSection";
const base = { isVacant:false, moveOutDate:"", billingEnabled:true, printEnabled:true, lateFeeEnabled:true, singlePrint:false, billingNote:"", settlementNote:"" };
describe("BillingSettingsSection", () => {
  it("공실 체크 → onChange({isVacant:true})", () => {
    const onChange = vi.fn();
    render(<BillingSettingsSection value={base} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("공실 처리"));
    expect(onChange).toHaveBeenCalledWith({ isVacant: true });
  });
  it("적요 입력 → onChange({billingNote})", () => {
    const onChange = vi.fn();
    render(<BillingSettingsSection value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("적요"), { target: { value: "메모" } });
    expect(onChange).toHaveBeenCalledWith({ billingNote: "메모" });
  });
});
