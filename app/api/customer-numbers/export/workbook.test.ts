import { describe, expect, it } from "vitest";
import type { CustomerNumberLookupRow } from "@/hooks/reactquery/buildingCustomerNumbers";
import { buildCustomerNumberWorkbookData } from "./workbook";

const rows: CustomerNumberLookupRow[] = [
  {
    id: 1,
    buildingId: 11,
    buildingName: "해오름빌",
    kind: "water",
    customerNo: "W-1001",
    holderName: "김수도",
    meterDay: 15,
    billingBasis: "prev",
    printOnBill: true,
  },
  {
    id: 2,
    buildingId: 11,
    buildingName: "해오름빌",
    kind: "common_elec",
    customerNo: "CE-1001",
    holderName: null,
    meterDay: null,
    billingBasis: "current",
    printOnBill: false,
  },
  {
    id: 3,
    buildingId: 12,
    buildingName: "푸른빌딩",
    kind: "elec",
    customerNo: "E-2001",
    holderName: "이전기",
    meterDay: 20,
    billingBasis: "current",
    printOnBill: true,
  },
  {
    id: 4,
    buildingId: 12,
    buildingName: "푸른빌딩",
    kind: "gas",
    customerNo: "G-2001",
    holderName: "박가스",
    meterDay: 25,
    billingBasis: "prev",
    printOnBill: false,
  },
];

describe("buildCustomerNumberWorkbookData", () => {
  it("테이블과 같은 헤더 및 한글·Y/N 변환 행을 만든다", () => {
    const workbook = buildCustomerNumberWorkbookData(rows);

    expect(workbook.columns.map(({ header }) => header)).toEqual([
      "건물명",
      "유형",
      "고객번호",
      "명의자",
      "검침일",
      "부과기준",
      "고지서출력",
    ]);
    expect(workbook.rows).toEqual([
      {
        buildingName: "해오름빌",
        kind: "수도",
        customerNo: "W-1001",
        holderName: "김수도",
        meterDay: 15,
        billingBasis: "전월",
        printOnBill: "Y",
      },
      {
        buildingName: "해오름빌",
        kind: "공용전기",
        customerNo: "CE-1001",
        holderName: "",
        meterDay: "",
        billingBasis: "당월",
        printOnBill: "N",
      },
      expect.objectContaining({ kind: "전기" }),
      expect.objectContaining({ kind: "가스" }),
    ]);
  });
});
