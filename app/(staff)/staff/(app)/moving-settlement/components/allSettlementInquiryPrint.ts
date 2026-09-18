import type { SettlementInquiryRow } from "@/hooks/reactquery/movingSettlement";
import { formatDate } from "@/lib/format";
import { unitNoLabel } from "./AllSettlementInquiryTable";
import {
  locationLabel,
  type SettlementInquiryEdits,
} from "./settlementInquiryTypes";

const PRINT_SHEET_ID = "msPrintSheet";
const PRINT_STYLE_ID = "msPrintCss";

const PRINT_CSS =
  "@media screen{#msPrintSheet{display:none}}" +
  "@media print{" +
  "@page{size:A4 landscape;margin:10mm}" +
  "html,body{background:#fff!important;height:auto!important;overflow:visible!important}" +
  "body>*:not(#msPrintSheet){display:none!important}" +
  "#msPrintSheet{display:block!important;background:#fff!important;color:#000}" +
  "#msPrintSheet h1{text-align:center;font-size:14pt;font-weight:700;margin:0 0 4mm;text-decoration:underline}" +
  "#msPrintSheet thead{display:table-header-group}" +
  "#msPrintSheet tr{page-break-inside:avoid}" +
  "#msPrintSheet table{width:100%;border-collapse:collapse;font-size:7.6pt}" +
  "#msPrintSheet th,#msPrintSheet td{border:1px solid #000;padding:.9mm 1.2mm;white-space:nowrap}" +
  "#msPrintSheet thead th{background:#EDEDED;text-align:center;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
  "#msPrintSheet td.c{text-align:center}" +
  "#msPrintSheet td.r{text-align:right}" +
  "#msPrintSheet tr.tot>td{background:#E8E8E8;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
  "}";

const HEADERS = [
  "NO",
  "소재지",
  "건물명",
  "호실",
  "해약일자",
  "입주일",
  "전기검침",
  "전기이주",
  "량",
  "금액",
  "입금일자",
  "가스검침",
  "가스이주",
  "량",
  "금액",
  "입금일자",
  "당월계",
  "입력검사",
  "청소비용",
  "상태",
] as const;

type PrintNumber = number | string | null | undefined;

function printNumber(value: PrintNumber): string {
  if (value == null || value === "") return "";
  const number = Number(value);
  return number ? number.toLocaleString() : "";
}

function appendCell(
  row: HTMLTableRowElement,
  value: string,
  className?: "c" | "r",
  colSpan?: number,
): void {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  if (colSpan !== undefined) cell.colSpan = colSpan;
  cell.textContent = value;
  row.appendChild(cell);
}

function total(
  rows: SettlementInquiryRow[],
  value: (row: SettlementInquiryRow) => number | null,
): number {
  return rows.reduce((sum, row) => sum + (value(row) ?? 0), 0);
}

export function printAllSettlementInquiry(
  rows: SettlementInquiryRow[],
  edits: SettlementInquiryEdits,
): void {
  document.getElementById(PRINT_SHEET_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);

  const sheet = document.createElement("div");
  sheet.id = PRINT_SHEET_ID;

  const heading = document.createElement("h1");
  heading.textContent = "[ 이사정산 현황 ]";

  const table = document.createElement("table");
  const tableHead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  HEADERS.forEach((header) => {
    const cell = document.createElement("th");
    cell.textContent = header;
    headerRow.appendChild(cell);
  });
  tableHead.appendChild(headerRow);

  const tableBody = document.createElement("tbody");
  rows.forEach((row, index) => {
    const edit = edits[row.settlementId];
    const elecPaidDate = edit?.elecPaidDate ?? row.elecPaidDate;
    const gasPaidDate = edit?.gasPaidDate ?? row.gasPaidDate;
    const cleaningCost = edit?.cleaningCost ?? row.cleaningCost;
    const dataRow = document.createElement("tr");

    appendCell(dataRow, String(index + 1), "c");
    appendCell(dataRow, locationLabel(row.buildingAddress, row.dong));
    appendCell(dataRow, row.buildingName);
    appendCell(dataRow, unitNoLabel(row.unitNo), "c");
    appendCell(dataRow, formatDate(row.moveOutDate, { nullText: "" }), "c");
    appendCell(dataRow, formatDate(row.moveInDate, { nullText: "" }), "c");
    appendCell(dataRow, printNumber(row.elecPreviousReading), "r");
    appendCell(dataRow, printNumber(row.elecCurrentReading), "r");
    appendCell(dataRow, printNumber(row.elecUsage), "r");
    appendCell(dataRow, printNumber(row.elecCharge), "r");
    appendCell(dataRow, formatDate(elecPaidDate, { nullText: "" }), "c");
    appendCell(dataRow, printNumber(row.gasPreviousReading), "r");
    appendCell(dataRow, printNumber(row.gasCurrentReading), "r");
    appendCell(dataRow, printNumber(row.gasUsage), "r");
    appendCell(dataRow, printNumber(row.gasCharge), "r");
    appendCell(dataRow, formatDate(gasPaidDate, { nullText: "" }), "c");
    appendCell(dataRow, printNumber(row.mgmtFeeProrated), "r");
    appendCell(dataRow, row.checkedByName ?? "");
    appendCell(dataRow, printNumber(cleaningCost), "r");
    appendCell(dataRow, row.status === "completed" ? "완결" : "미결", "c");

    tableBody.appendChild(dataRow);
  });

  const totalRow = document.createElement("tr");
  totalRow.className = "tot";
  appendCell(totalRow, `합계 ${rows.length}건`, "c", 9);
  appendCell(
    totalRow,
    printNumber(total(rows, (row) => row.elecCharge)),
    "r",
  );
  appendCell(totalRow, "");
  appendCell(totalRow, "", undefined, 3);
  appendCell(
    totalRow,
    printNumber(total(rows, (row) => row.gasCharge)),
    "r",
  );
  appendCell(totalRow, "");
  appendCell(
    totalRow,
    printNumber(total(rows, (row) => row.mgmtFeeProrated)),
    "r",
  );
  appendCell(totalRow, "", undefined, 3);
  tableBody.appendChild(totalRow);

  table.append(tableHead, tableBody);
  sheet.append(heading, table);
  document.body.appendChild(sheet);

  window.setTimeout(() => {
    try {
      window.print();
    } catch {
      // Printing may be unavailable in embedded browser contexts.
    }
    window.setTimeout(() => {
      sheet.remove();
      style.remove();
    }, 800);
  }, 250);
}
