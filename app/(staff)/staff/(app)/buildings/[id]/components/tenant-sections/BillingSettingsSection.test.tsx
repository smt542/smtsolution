// app/(staff)/staff/buildings/[id]/components/tenant-sections/BillingSettingsSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillingSettingsSection } from "./BillingSettingsSection";
const base = { billingEnabled:true, lateFeeEnabled:true, singlePrint:false, transferMethod:"none" as const, billingNote:"", settlementNote:"" };
describe("BillingSettingsSection", () => {
  it("이체 방식을 enum 값으로 변경한다", () => {
    const onChange = vi.fn();
    render(<BillingSettingsSection value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("이체 방식"), { target: { value: "auto_transfer" } });
    expect(onChange).toHaveBeenCalledWith({ transferMethod: "auto_transfer" });
  });
  it("적요 입력 → onChange({billingNote})", () => {
    const onChange = vi.fn();
    render(<BillingSettingsSection value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("적요"), { target: { value: "메모" } });
    expect(onChange).toHaveBeenCalledWith({ billingNote: "메모" });
  });
});
