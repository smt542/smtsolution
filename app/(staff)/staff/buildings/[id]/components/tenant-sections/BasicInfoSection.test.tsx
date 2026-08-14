// app/(staff)/staff/buildings/[id]/components/tenant-sections/BasicInfoSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BasicInfoSection } from "./BasicInfoSection";
const base = { unitNo:"", floor:null, usageType:"residential" as const, tenantName:"", payerName:"", phone:"", phone2:"", phone3:"", vehicleNo:"", residentCount:null, roomTypeId:null, moveInDate:"" };
describe("tenant BasicInfoSection", () => {
  it("이름 입력 → onChange({tenantName})", () => {
    const onChange = vi.fn();
    render(<BasicInfoSection value={base} onChange={onChange} roomTypeOptions={[{ value:"", label:"선택" }]} />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김입주" } });
    expect(onChange).toHaveBeenCalledWith({ tenantName: "김입주" });
  });
  it("룸타입 선택 → onChange({roomTypeId:number})", () => {
    const onChange = vi.fn();
    render(<BasicInfoSection value={base} onChange={onChange} roomTypeOptions={[{ value:"", label:"선택" }, { value:"1", label:"원룸" }]} />);
    fireEvent.change(screen.getByLabelText("룸타입"), { target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith({ roomTypeId: 1 });
  });
  it("세대 용도와 층 입력을 도메인 값으로 변환한다", () => {
    const onChange = vi.fn();
    render(<BasicInfoSection value={base} onChange={onChange} roomTypeOptions={[]} />);
    fireEvent.change(screen.getByLabelText("용도"), { target: { value: "commercial" } });
    fireEvent.change(screen.getByLabelText("층"), { target: { value: "-1" } });
    expect(onChange).toHaveBeenCalledWith({ usageType: "commercial" });
    expect(onChange).toHaveBeenCalledWith({ floor: -1 });
  });
  it("빈 층 입력을 null로 변환한다", () => {
    const onChange = vi.fn();
    render(<BasicInfoSection value={{ ...base, floor: 3 }} onChange={onChange} roomTypeOptions={[]} />);
    fireEvent.change(screen.getByLabelText("층"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ floor: null });
  });
});
