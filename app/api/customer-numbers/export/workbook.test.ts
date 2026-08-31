import { describe, expect, it } from "vitest";
import type { CustomerNumberLookupRow } from "@/hooks/reactquery/buildingCustomerNumbers";
import { buildCustomerNumberWorkbookData } from "./workbook";

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

describe("buildCustomerNumberWorkbookData", () => {
  it("조회 표와 동일한 열과 한글 변환 값을 만든다", () => {
    const workbook = buildCustomerNumberWorkbookData(rows, "water");

    expect(workbook.columns.map(({ header }) => header)).toEqual([
      "코드",
      "빌라명",
      "주소",
      "LIN",
      "수도고객번호",
      "일금일",
      "구분",
      "계산",
      "기타적요",
    ]);
    expect(workbook.rows).toEqual([
      {
        buildingCode: "B0011",
        buildingName: "해오름빌라",
        address: "서울시 강남구",
        lineName: "A",
        customerNo: "W-1001",
        meterDay: 15,
        billingBasis: "전월",
        calculationMethod: "수동",
        note: "옥상 수도",
      },
    ]);
  });
});
