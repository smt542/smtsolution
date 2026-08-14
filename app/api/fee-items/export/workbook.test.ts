import { describe, expect, it } from "vitest";
import type { FeeItemLookupRow } from "@/hooks/reactquery/feeItems";
import { buildFeeItemWorkbookData } from "./workbook";

const rows: FeeItemLookupRow[] = [
  {
    id: 1,
    typeId: 7,
    typeLabel: "원룸텔",
    name: "일반관리비",
    rounding: "round",
    dailyProration: true,
    carryOver: false,
    isRequired: true,
    sortOrder: 2,
  },
  {
    id: 2,
    typeId: 7,
    typeLabel: "원룸텔",
    name: "수도료",
    rounding: "up",
    dailyProration: false,
    carryOver: true,
    isRequired: false,
    sortOrder: 3,
  },
  {
    id: 3,
    typeId: 8,
    typeLabel: "상가",
    name: "전기료",
    rounding: "down",
    dailyProration: false,
    carryOver: false,
    isRequired: false,
    sortOrder: 0,
  },
  {
    id: 4,
    typeId: 8,
    typeLabel: "상가",
    name: "청소비",
    rounding: "raw",
    dailyProration: true,
    carryOver: true,
    isRequired: true,
    sortOrder: 1,
  },
];

describe("buildFeeItemWorkbookData", () => {
  it("uses the expected column headers and keys in order", () => {
    const workbook = buildFeeItemWorkbookData(rows);

    expect(workbook.columns.map(({ header }) => header)).toEqual([
      "건물유형",
      "항목명",
      "반올림",
      "일할계산",
      "이월",
      "필수",
      "정렬순서",
    ]);
    expect(workbook.columns.map(({ key }) => key)).toEqual([
      "typeLabel",
      "name",
      "rounding",
      "dailyProration",
      "carryOver",
      "isRequired",
      "sortOrder",
    ]);
  });

  it("maps rounding, boolean, and required labels for export", () => {
    const workbook = buildFeeItemWorkbookData(rows);

    expect(workbook.rows).toEqual([
      {
        typeLabel: "원룸텔",
        name: "일반관리비",
        rounding: "반올림",
        dailyProration: "Y",
        carryOver: "N",
        isRequired: "필수",
        sortOrder: 2,
      },
      expect.objectContaining({ rounding: "올림", isRequired: "선택" }),
      expect.objectContaining({ rounding: "내림", isRequired: "선택" }),
      expect.objectContaining({ rounding: "원값", isRequired: "필수" }),
    ]);
  });
});
