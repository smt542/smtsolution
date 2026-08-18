import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VendorSection, type VendorRow } from "./VendorSection";

describe("VendorSection", () => {
  it("+ 추가 시 빈 업체 행(pendingFiles=[])", () => {
    const onChange = vi.fn();
    render(<VendorSection rows={[]} onChange={onChange} onDeleteExisting={vi.fn()} onViewExisting={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /협력업체 추가/ }));
    const next = onChange.mock.calls[0][0] as VendorRow[];
    expect(next[0]).toMatchObject({ vendorType: "elevator", name: "", pendingFiles: [] });
  });
  it("업체명 입력 → onChange", () => {
    const onChange = vi.fn();
    const rows: VendorRow[] = [{ _key: "v1", vendorType: "elevator", name: "", phone: "", memo: "", pendingFiles: [], existing: [] }];
    render(<VendorSection rows={rows} onChange={onChange} onDeleteExisting={vi.fn()} onViewExisting={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("업체명"), { target: { value: "한국승강기" } });
    const next = onChange.mock.calls[0][0] as VendorRow[];
    expect(next[0].name).toBe("한국승강기");
  });
  it("기존 계약서 파일명 클릭 → onViewExisting(path)로 원본 열람", () => {
    const onViewExisting = vi.fn();
    const rows: VendorRow[] = [{
      _key: "v1", id: 1, vendorType: "fire", name: "OO소방", phone: "", memo: "",
      pendingFiles: [], existing: [{ id: 10, path: "1/building_vendor/1/a.pdf", name: "계약서.pdf" }],
    }];
    render(<VendorSection rows={rows} onChange={vi.fn()} onDeleteExisting={vi.fn()} onViewExisting={onViewExisting} />);
    fireEvent.click(screen.getByRole("button", { name: /계약서\.pdf 원본 보기/ }));
    expect(onViewExisting).toHaveBeenCalledWith("1/building_vendor/1/a.pdf");
  });
});
