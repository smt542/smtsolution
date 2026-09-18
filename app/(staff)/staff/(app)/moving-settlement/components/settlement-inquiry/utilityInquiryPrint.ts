import type {
  SettlementInquiryRow,
  UpdateSettlementInquiryRow,
} from "@/hooks/reactquery/movingSettlement";
import type { OrganizationPrintInfo } from "@/hooks/reactquery/org/useOrganizationPrintInfo";
import { locationLabel, unitNoLabel } from "../settlementInquiryTypes";
import {
  getUtilityInquiryFieldMapping,
  type UtilityInquiryType,
} from "./utilityInquiryColumns";

const PRINT_SHEET_ID = "msPrintSheet";
const PRINT_STYLE_ID = "msPrintCss";

const PRINT_CSS = `
@media screen{#msPrintSheet{display:none}}
@media print{
@page{size:A4 landscape;margin:10mm}
html,body{background:#fff!important;height:auto!important;overflow:visible!important}
body>*:not(#msPrintSheet){display:none!important}
#msPrintSheet{display:block!important;background:#fff!important;color:#000;line-height:normal}
#msPrintSheet h1{text-align:center;font-size:16pt;font-weight:700;text-decoration:underline;margin:0 0 5mm}
#msPrintSheet .req{font-size:9.5pt;font-weight:700;margin-bottom:2.5mm}
#msPrintSheet thead{display:table-header-group}
#msPrintSheet tr{page-break-inside:avoid}
#msPrintSheet table{width:100%;border-collapse:collapse;font-size:8.4pt}
#msPrintSheet th,#msPrintSheet td{border:1px solid #000;padding:1.1mm 1.4mm;white-space:nowrap}
#msPrintSheet thead th{background:#EDEDED;text-align:center;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#msPrintSheet td.c{text-align:center}
#msPrintSheet td.r{text-align:right}
#msPrintSheet tr.tot>td{background:#E8E8E8;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#msPrintSheet table.foot{margin-top:8mm;table-layout:fixed}
#msPrintSheet table.foot th{background:#F4F4F4;text-align:center;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#msPrintSheet table.foot td{height:7mm;white-space:normal}
}`;

interface PrintHeader {
  label: string;
  secondLine?: string;
}

function printNumber(value: number | string | null | undefined): string {
  return value ? Number(value).toLocaleString() : "";
}

function printDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10).replaceAll("-", ".") : "";
}

function applicationDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year}년 ${month}월 ${day}일` : "";
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function appendCell(
  row: HTMLTableRowElement,
  tagName: "th" | "td",
  value: string,
  className?: "c" | "r",
  colSpan?: number,
): void {
  const cell = createElement(tagName, className);
  if (colSpan !== undefined) cell.colSpan = colSpan;
  cell.textContent = value;
  row.appendChild(cell);
}

function appendHeaderCell(
  row: HTMLTableRowElement,
  header: PrintHeader,
): void {
  const cell = createElement("th");
  cell.textContent = header.label;
  if (header.secondLine) {
    cell.appendChild(document.createElement("br"));
    cell.appendChild(document.createTextNode(header.secondLine));
  }
  row.appendChild(cell);
}

function sumColumn(
  rows: SettlementInquiryRow[],
  field: keyof SettlementInquiryRow,
): number {
  return rows.reduce((sum, row) => {
    const value = row[field];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

function getHeaders(type: UtilityInquiryType): PrintHeader[] {
  return [
    { label: "NO" },
    { label: "소재지" },
    { label: "건물명" },
    { label: "건 물 주 소" },
    { label: "호실" },
    { label: "해약일자" },
    ...(type === "electric" ? [{ label: "계 기 번 호" }] : []),
    { label: "고 객 번 호" },
    { label: "최종", secondLine: "검침" },
    { label: "이주", secondLine: "검침" },
    { label: "사용량" },
    { label: "정산요금" },
    {
      label:
        type === "electric"
          ? "한전입금일"
          : type === "gas"
            ? "가스입금일"
            : "수도입금일",
    },
  ];
}

function appendMainTable(
  sheet: HTMLElement,
  type: UtilityInquiryType,
  rows: SettlementInquiryRow[],
  edits: Record<number, UpdateSettlementInquiryRow>,
): void {
  const fields = getUtilityInquiryFieldMapping(type);
  const table = createElement("table");
  const head = createElement("thead");
  const headerRow = createElement("tr");
  getHeaders(type).forEach((header) => appendHeaderCell(headerRow, header));
  head.appendChild(headerRow);

  const body = createElement("tbody");
  rows.forEach((row, index) => {
    const edit = edits[row.settlementId];
    const paidDate = edit ? edit[fields.paidDate] : row[fields.paidDate];
    const dataRow = createElement("tr");

    appendCell(dataRow, "td", String(index + 1), "c");
    appendCell(dataRow, "td", locationLabel(row.buildingAddress, row.dong));
    appendCell(dataRow, "td", row.buildingName);
    appendCell(dataRow, "td", row.buildingAddress ?? "");
    appendCell(dataRow, "td", unitNoLabel(row.unitNo), "c");
    appendCell(dataRow, "td", printDate(row.moveOutDate), "c");
    if (type === "electric") {
      appendCell(dataRow, "td", row.meterNo ?? "", "c");
    }
    appendCell(dataRow, "td", row.customerNo ?? "", "c");
    appendCell(dataRow, "td", printNumber(row[fields.previousReading]), "r");
    appendCell(dataRow, "td", printNumber(row[fields.currentReading]), "r");
    appendCell(dataRow, "td", printNumber(row[fields.usage]), "r");
    appendCell(dataRow, "td", printNumber(row[fields.charge]), "r");
    appendCell(dataRow, "td", printDate(paidDate), "c");
    body.appendChild(dataRow);
  });

  const totalRow = createElement("tr", "tot");
  appendCell(totalRow, "td", `합계 ${rows.length}건`, "c", type === "electric" ? 10 : 9);
  appendCell(totalRow, "td", printNumber(sumColumn(rows, fields.usage)), "r");
  appendCell(totalRow, "td", printNumber(sumColumn(rows, fields.charge)), "r");
  appendCell(totalRow, "td", "");
  body.appendChild(totalRow);

  table.append(head, body);
  sheet.appendChild(table);
}

function appendOrganizationTable(
  sheet: HTMLElement,
  organization: OrganizationPrintInfo | null | undefined,
): void {
  const table = createElement("table", "foot");
  const colGroup = createElement("colgroup");
  ["9%", "16%", "9%", "20%", "9%", "12%", "9%", "16%"].forEach((width) => {
    const col = createElement("col");
    col.style.width = width;
    colGroup.appendChild(col);
  });
  table.appendChild(colGroup);

  const body = createElement("tbody");
  const accountRow = createElement("tr");
  appendCell(accountRow, "th", "은행명");
  appendCell(accountRow, "td", "");
  appendCell(accountRow, "th", "계좌번호");
  appendCell(accountRow, "td", "");
  appendCell(accountRow, "th", "예금주");
  appendCell(accountRow, "td", "");
  appendCell(accountRow, "th", "주민번호");
  appendCell(accountRow, "td", "");
  body.appendChild(accountRow);

  const contactRow = createElement("tr");
  appendCell(contactRow, "th", "전화번호");
  appendCell(contactRow, "td", organization?.phone ?? "");
  appendCell(contactRow, "th", "휴대번호");
  appendCell(contactRow, "td", "");
  appendCell(contactRow, "th", "팩스번호");
  appendCell(contactRow, "td", organization?.fax ?? "");
  appendCell(contactRow, "th", "대표자");
  appendCell(contactRow, "td", organization?.representativeName ?? "");
  body.appendChild(contactRow);

  const addressRow = createElement("tr");
  appendCell(addressRow, "th", "관리업체");
  appendCell(addressRow, "td", organization?.name ?? "");
  appendCell(addressRow, "th", "주 소");
  appendCell(addressRow, "td", organization?.address ?? "", undefined, 5);
  body.appendChild(addressRow);

  table.appendChild(body);
  sheet.appendChild(table);
}

function removePrintArtifacts(): void {
  document.getElementById(PRINT_SHEET_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();
}

export function printUtilityInquiry(
  type: UtilityInquiryType,
  rows: SettlementInquiryRow[],
  edits: Record<number, UpdateSettlementInquiryRow>,
  appliedFrom: string,
  organization?: OrganizationPrintInfo | null,
): void {
  removePrintArtifacts();

  const style = createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);

  const sheet = createElement("div");
  sheet.id = PRINT_SHEET_ID;

  const title = createElement("h1");
  title.textContent = `이사정산요청서(${type === "electric" ? "전기" : type === "gas" ? "가스" : "수도"})`;
  const requestDate = createElement("div", "req");
  requestDate.textContent = `신청일자 : ${applicationDate(appliedFrom)}`;
  sheet.append(title, requestDate);
  appendMainTable(sheet, type, rows, edits);
  appendOrganizationTable(sheet, organization);
  document.body.appendChild(sheet);

  window.setTimeout(() => {
    try {
      window.print();
    } catch {
      // Printing may be unavailable in embedded browser contexts.
    }
    window.setTimeout(removePrintArtifacts, 800);
  }, 250);
}
