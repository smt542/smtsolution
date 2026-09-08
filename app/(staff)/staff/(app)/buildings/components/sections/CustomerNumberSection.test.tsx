import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerNumberSection, type CustomerRow } from "./CustomerNumberSection";

const row = (value: Partial<CustomerRow> = {}): CustomerRow => ({
  _key: "k1",
  kind: "water",
  customerNo: "C1",
  lineName: "",
  meterDay: null,
  billingBasis: "current",
  calculationMethod: "manual",
  note: "",
  printOnBill: true,
  holderName: "",
  ...value,
});

describe("CustomerNumberSection", () => {
  it("추가하면 조회 필드 기본값을 포함한 수도 행을 만든다", () => {
    const onChange = vi.fn();
    render(<CustomerNumberSection rows={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /고객번호 추가/ }));

    const next = onChange.mock.calls[0][0] as CustomerRow[];
    expect(next[0]).toMatchObject({
      kind: "water",
      lineName: "",
      calculationMethod: "auto",
      note: "",
    });
  });

  it("신규 행은 제거하고 기존 행은 삭제 표시한다", () => {
    const onChange = vi.fn();
    const rows = [row(), row({ _key: "k2", id: 9, kind: "gas", customerNo: "C2" })];
    render(<CustomerNumberSection rows={rows} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);

    const next = onChange.mock.calls[0][0] as CustomerRow[];
    expect(next.find((item) => item._key === "k1")).toBeUndefined();
  });

  it("공용전기로 바꾸면 계산 방식은 자동으로 고정한다", () => {
    const onChange = vi.fn();
    render(<CustomerNumberSection rows={[row()]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("유형"), { target: { value: "common_elec" } });

    expect(onChange.mock.calls[0][0][0]).toMatchObject({
      kind: "common_elec",
      calculationMethod: "auto",
    });
  });
});
