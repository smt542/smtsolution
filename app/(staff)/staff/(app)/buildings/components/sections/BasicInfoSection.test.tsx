import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BasicInfoSection } from "./BasicInfoSection";

const base = { code: "", name: "", address: "", managerUserId: null, meterUserId: null, cleaningUserId: null };

describe("BasicInfoSection", () => {
  it("건물명 입력 → onChange({name})", () => {
    const onChange = vi.fn();
    render(<BasicInfoSection value={base} onChange={onChange} staffOptions={[{ value: "", label: "미지정" }]} />);
    fireEvent.change(screen.getByLabelText("건물명"), { target: { value: "가나빌" } });
    expect(onChange).toHaveBeenCalledWith({ name: "가나빌" });
  });
  it("관리담당자 선택 → onChange({managerUserId})", () => {
    const onChange = vi.fn();
    render(<BasicInfoSection value={base} onChange={onChange} staffOptions={[{ value: "", label: "미지정" }, { value: "u1", label: "김관리" }]} />);
    fireEvent.change(screen.getByLabelText("관리담당자"), { target: { value: "u1" } });
    expect(onChange).toHaveBeenCalledWith({ managerUserId: "u1" });
  });
});
