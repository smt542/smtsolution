"use client";

import { useState } from "react";
import { deriveAutoDebitCells, filterAutoDebitRowsByGroup, type AutoDebitRow } from "./AutoDebitTable";

const ADT_CSS = `
.adt-print-root{
  font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  background:#fff;
  color:#191f28;
}
.adt-document{
  box-sizing:border-box;
  padding:8mm 0;
  background:#fff;
}
.adt-title{
  margin:0 0 3mm;
  font-size:14pt;
  font-weight:800;
  text-align:left;
}
.adt-meta{
  margin:0 0 5mm;
  color:#6B7684;
  font-size:9pt;
}
.adt-table{
  width:100%;
  border-collapse:collapse;
  font-size:8.5pt;
}
.adt-table th,
.adt-table td{
  border:1px solid #C9CDD2;
  padding:1.6mm 2mm;
  white-space:nowrap;
}
/* 인쇄 시 브라우저가 배경색을 기본으로 지우므로, 헤더 음영은 color-adjust로 강제한다. */
.adt-table th{
  background:#F2F4F6;
  text-align:left;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
.adt-table td{
  background:#fff;
}
.adt-table thead{
  display:table-header-group;
}
.adt-table tr{
  page-break-inside:avoid;
  break-inside:avoid;
}
@media print{
  @page{size:A4 landscape;margin:8mm;}
}
`;

const COLUMN_LABELS = [
  "청구타입",
  "회원번호",
  "계약번호",
  "회원명",
  "청구월",
  "약정일",
  "결제일(결제시작일)",
  "상품",
  "기본금액",
  "수량",
  "회원구분",
];

function AutoDebitPrintTitle({ year, month, group }: Pick<AutoDebitPrintDocumentProps, "year" | "month" | "group">) {
  return <h1 className="adt-title">{year}년 {month}월분 자동이체 세대{group !== 0 ? ` · ${group}그룹` : ""}</h1>;
}

function AutoDebitPrintMeta({ rowCount, outputDate }: { rowCount: number; outputDate: string }) {
  return <p className="adt-meta">총 {rowCount}건 · 출력일 {outputDate}</p>;
}

function AutoDebitPrintTable({ rows, year, month }: Pick<AutoDebitPrintDocumentProps, "rows" | "year" | "month">) {
  return (
    <table className="adt-table">
      <thead>
        <tr>{COLUMN_LABELS.map((label) => <th key={label}>{label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map(({ building, target }) => {
          const cells = deriveAutoDebitCells(building, target, year, month);
          return (
            <tr key={`${building.id}-${target.unitId}`}>
              <td>{cells.billType}</td>
              <td>{cells.memberNo}</td>
              <td>{cells.contractNo}</td>
              <td>{cells.memberName}</td>
              <td>{cells.billMonth}</td>
              <td>{cells.agreedDay}</td>
              <td>{cells.paymentDate}</td>
              <td>{cells.product}</td>
              <td>{cells.baseAmount}</td>
              <td>{cells.quantity}</td>
              <td>{cells.memberGroup}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export interface AutoDebitPrintDocumentProps {
  year: number;
  month: number;
  group: number;
  rows: AutoDebitRow[];
}

export function AutoDebitPrintDocument({ year, month, group, rows }: AutoDebitPrintDocumentProps) {
  const [outputDate] = useState(() => new Date().toLocaleDateString("ko-KR"));
  const visibleRows = filterAutoDebitRowsByGroup(rows, group);

  return (
    <div className="hidden print:block adt-print-root" data-testid="auto-debit-print-root">
      <style>{ADT_CSS}</style>
      <div className="adt-document">
        <AutoDebitPrintTitle year={year} month={month} group={group} />
        <AutoDebitPrintMeta rowCount={visibleRows.length} outputDate={outputDate} />
        <AutoDebitPrintTable rows={visibleRows} year={year} month={month} />
      </div>
    </div>
  );
}
