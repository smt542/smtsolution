// app/(staff)/staff/buildings/[id]/components/tenant-sections/LeaseSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LeaseSection } from "./LeaseSection";
const base = { deposit:null, monthlyRent:null, startDate:"", endDate:"", expiryAlert:false };
describe("LeaseSection", () => {
  it("보증금 입력 → onChange(number)", () => {
    const onChange = vi.fn();
    render(<LeaseSection value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("보증금"), { target: { value: "1000000" } });
    expect(onChange).toHaveBeenCalledWith({ deposit: 1000000 });
  });
});
