import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VendorSection, type VendorRow } from "./VendorSection";

describe("VendorSection", () => {
  it("+ 추가 시 빈 업체 행(pendingFiles=[])", () => {
    const onChange = vi.fn();
    render(<VendorSection rows={[]} onChange={onChange} onDeleteExisting={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /협력업체 추가/ }));
    const next = onChange.mock.calls[0][0] as VendorRow[];
    expect(next[0]).toMatchObject({ vendorType: "elevator", name: "", pendingFiles: [] });
  });
  it("업체명 입력 → onChange", () => {
    const onChange = vi.fn();
    const rows: VendorRow[] = [{ _key: "v1", vendorType: "elevator", name: "", phone: "", memo: "", pendingFiles: [], existing: [] }];
    render(<VendorSection rows={rows} onChange={onChange} onDeleteExisting={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("업체명"), { target: { value: "한국승강기" } });
    const next = onChange.mock.calls[0][0] as VendorRow[];
    expect(next[0].name).toBe("한국승강기");
  });
});
