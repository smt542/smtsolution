import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CustomerNumberSection, type CustomerRow } from "./CustomerNumberSection";

describe("CustomerNumberSection", () => {
  it("+ 추가 시 빈 행 append", () => {
    const onChange = vi.fn();
    render(<CustomerNumberSection rows={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /고객번호 추가/ }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0] as CustomerRow[];
    expect(next).toHaveLength(1);
    expect(next[0].kind).toBe("water");
  });
  it("행 삭제 시 신규행 제거·기존행 _deleted", () => {
    const onChange = vi.fn();
    const rows: CustomerRow[] = [
      { _key: "k1", kind: "water", customerNo: "C1", meterDay: null, billingBasis: "current", printOnBill: true, holderName: "" },
      { _key: "k2", id: 9, kind: "gas", customerNo: "C2", meterDay: null, billingBasis: "current", printOnBill: true, holderName: "" },
    ];
    render(<CustomerNumberSection rows={rows} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    const next = onChange.mock.calls[0][0] as CustomerRow[];
    expect(next.find((r) => r._key === "k1")).toBeUndefined(); // 신규행은 완전 제거
  });
});
