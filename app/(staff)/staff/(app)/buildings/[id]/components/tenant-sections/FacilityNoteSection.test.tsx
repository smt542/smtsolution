// app/(staff)/staff/buildings/[id]/components/tenant-sections/FacilityNoteSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FacilityNoteSection } from "./FacilityNoteSection";
describe("FacilityNoteSection", () => {
  it("입력 → onChange", () => {
    const onChange = vi.fn();
    render(<FacilityNoteSection value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("시설 정보"), { target: { value: "보일러 교체" } });
    expect(onChange).toHaveBeenCalledWith("보일러 교체");
  });
});
