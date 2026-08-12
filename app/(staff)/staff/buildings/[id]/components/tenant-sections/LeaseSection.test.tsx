// app/(staff)/staff/buildings/[id]/components/tenant-sections/LeaseSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LeaseSection } from "./LeaseSection";
const base = { deposit:null, monthlyRent:null, startDate:"", endDate:"", expiryAlert:false };
describe("LeaseSection", () => {
  it("보증금 입력 → onChange(number)", () => {
    const onChange = vi.fn();
    render(<LeaseSection value={base} onChange={onChange} history={[]} />);
    fireEvent.change(screen.getByLabelText("보증금"), { target: { value: "1000000" } });
    expect(onChange).toHaveBeenCalledWith({ deposit: 1000000 });
  });
  it("전출자 이력 읽기전용 표시", () => {
    render(<LeaseSection value={base} onChange={vi.fn()} history={[{ id:1, unitId:3, tenantName:"김전출", moveInDate:"2025-01-01", moveOutDate:"2026-01-01", roomTypeLabel:"원룸" }]} />);
    expect(screen.getByText("김전출")).toBeInTheDocument();
  });
});
