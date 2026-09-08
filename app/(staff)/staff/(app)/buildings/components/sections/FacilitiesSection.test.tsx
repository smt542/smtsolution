import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FacilitiesSection } from "./FacilitiesSection";
import { emptyFacilities } from "@/hooks/reactquery/buildings";

describe("FacilitiesSection", () => {
  it("체크 시 on=true로 onChange, 메모 활성", () => {
    const onChange = vi.fn();
    render(<FacilitiesSection value={emptyFacilities()} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("CCTV"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cctv: { on: true, memo: "" } }));
  });
  it("미체크 항목의 메모 입력란은 disabled", () => {
    render(<FacilitiesSection value={emptyFacilities()} onChange={vi.fn()} />);
    expect(screen.getByLabelText("CCTV 메모")).toBeDisabled();
  });
});
