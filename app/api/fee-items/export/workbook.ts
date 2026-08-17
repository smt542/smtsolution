import type { FeeItemLookupRow } from "@/hooks/reactquery/feeItems";
import type { XlsxColumn } from "@/lib/export/xlsx";

const ROUNDING_LABELS: Record<string, string> = {
  up: "올림",
  round: "반올림",
  down: "내림",
  raw: "원값",
};

interface FeeItemWorkbookData {
  columns: XlsxColumn[];
  rows: Record<string, unknown>[];
}

export function buildFeeItemWorkbookData(rows: FeeItemLookupRow[]): FeeItemWorkbookData {
  return {
    columns: [
      { header: "건물유형", key: "typeLabel", width: 18 },
      { header: "항목명", key: "name", width: 24 },
      { header: "반올림", key: "rounding", width: 10 },
      { header: "일할계산", key: "dailyProration", width: 10 },
      { header: "이월", key: "carryOver", width: 8 },
      { header: "필수", key: "isRequired", width: 8 },
      { header: "정렬순서", key: "sortOrder", width: 10 },
    ],
    rows: rows.map((row) => ({
      typeLabel: row.typeLabel,
      name: row.name,
      rounding: ROUNDING_LABELS[row.rounding] ?? row.rounding,
      dailyProration: row.dailyProration ? "Y" : "N",
      carryOver: row.carryOver ? "Y" : "N",
      isRequired: row.isRequired ? "필수" : "선택",
      sortOrder: row.sortOrder,
    })),
  };
}
