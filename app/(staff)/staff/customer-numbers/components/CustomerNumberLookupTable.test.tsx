import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CustomerNumberLookupRow } from "@/hooks/reactquery/buildingCustomerNumbers";
import { CustomerNumberLookupTable } from "./CustomerNumberLookupTable";

const rows: CustomerNumberLookupRow[] = [
  {
    id: 1,
    buildingId: 11,
    buildingName: "해오름빌",
    kind: "water",
    customerNo: "W-1001",
    holderName: "김명의",
    meterDay: 15,
    billingBasis: "prev",
    printOnBill: true,
  },
  {
    id: 2,
    buildingId: 12,
    buildingName: "푸른빌딩",
    kind: "gas",
    customerNo: "G-2002",
    holderName: null,
    meterDay: null,
    billingBasis: "current",
    printOnBill: false,
  },
];

describe("CustomerNumberLookupTable", () => {
  it("유형·부과기준을 한글로, 고지서 출력 여부를 Y/N으로 표시한다", () => {
    render(<CustomerNumberLookupTable rows={rows} onRowClick={() => {}} />);

    expect(screen.getByRole("columnheader", { name: "건물명" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "유형" })).toBeInTheDocument();
    expect(screen.getByText("수도")).toBeInTheDocument();
    expect(screen.getByText("가스")).toBeInTheDocument();
    expect(screen.getByText("전월")).toBeInTheDocument();
    expect(screen.getByText("당월")).toBeInTheDocument();
    expect(screen.getByText("Y")).toBeInTheDocument();
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("행을 클릭하면 해당 고객번호 행을 전달한다", () => {
    const onRowClick = vi.fn();
    render(<CustomerNumberLookupTable rows={rows} onRowClick={onRowClick} />);

    fireEvent.click(screen.getByText("W-1001"));

    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
