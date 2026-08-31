import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CustomerNumberLookupRow } from "@/hooks/reactquery/buildingCustomerNumbers";
import { CustomerNumberLookupTable } from "./CustomerNumberLookupTable";

const rows: CustomerNumberLookupRow[] = [
  {
    id: 1,
    buildingId: 11,
    buildingCode: "B0011",
    buildingName: "해오름빌라",
    address: "서울시 강남구",
    kind: "water",
    customerNo: "W-1001",
    lineName: "A",
    meterDay: 15,
    billingBasis: "prev",
    calculationMethod: "manual",
    note: "옥상 수도",
  },
];

describe("CustomerNumberLookupTable", () => {
  it("PRD의 조회 전용 열과 값을 표시한다", () => {
    render(<CustomerNumberLookupTable rows={rows} kind="water" />);

    for (const heading of ["코드", "빌라명", "주소", "LIN", "수도고객번호", "일금일", "구분", "계산", "기타적요"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText("B0011")).toBeInTheDocument();
    expect(screen.getByText("전월")).toBeInTheDocument();
    expect(screen.getByText("수동")).toBeInTheDocument();
    expect(screen.getByText("옥상 수도")).toBeInTheDocument();
    expect(screen.getAllByRole("row")[1]).not.toHaveAttribute("tabindex");
  });

  it("공용전기 탭에서는 고객번호 열 제목을 변경한다", () => {
    render(<CustomerNumberLookupTable rows={rows} kind="common_elec" />);
    expect(screen.getByRole("columnheader", { name: "공용전기고객번호" })).toBeInTheDocument();
  });
});
