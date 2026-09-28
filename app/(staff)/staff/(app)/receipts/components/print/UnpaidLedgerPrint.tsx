"use client";

import { PrintSheet } from "@/components/common/PrintSheet";
import type { OverdueDisplayGroup, OverdueRollup } from "../villa-overdue/buildOverdueGroups";
import { formatPeriodSlash } from "../villa-overdue/format";

const EM_SPACES = "\\2003".repeat(8);

function nz(value: number | null | undefined): string {
  return value ? value.toLocaleString("ko-KR") : "";
}

function printCss(printedAt: string): string {
  return `
@page {
  size: A4 portrait;
  margin: 14mm;
  @bottom-center {
    content: "페이지 : " counter(page) " / " counter(pages) "${EM_SPACES}출력일자 : ${printedAt}";
    font-size: 8.5pt;
    color: #000;
    font-family: inherit;
  }
}
#rcUnpaidPrint * { box-sizing: border-box; }
#rcUnpaidPrint { margin: 0; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#rcUnpaidPrint h1 { text-align: center; font-size: 15pt; font-weight: 700; letter-spacing: .04em; margin: 2mm 0 6mm; text-decoration: underline; }
#rcUnpaidPrint table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
#rcUnpaidPrint th, #rcUnpaidPrint td { border: 1px solid #000; padding: 1.1mm 1.6mm; white-space: nowrap; }
#rcUnpaidPrint thead th { background: #EDEDED; text-align: center; font-weight: 700; }
#rcUnpaidPrint thead { display: table-header-group; }
#rcUnpaidPrint tbody { break-inside: auto; }
#rcUnpaidPrint td.c { text-align: center; }
#rcUnpaidPrint td.r { text-align: right; }
#rcUnpaidPrint tr.sub > td { background: #F2F2F2; font-weight: 700; }
#rcUnpaidPrint tr.tot > td { background: #E8E8E8; font-weight: 700; }
#rcUnpaidPrint tr { page-break-inside: avoid; }
`;
}

export function UnpaidLedgerPrint({
  buildingName,
  year,
  month,
  groups,
  totals,
  printedAt,
  onDone,
}: {
  buildingName: string;
  year: number;
  month: number;
  groups: OverdueDisplayGroup[];
  totals: OverdueRollup & { lineCount: number; unitCount: number };
  printedAt: string;
  onDone: () => void;
}) {
  const monthLabel = String(month).padStart(2, "0");

  return (
    <PrintSheet id="rcUnpaidPrint" css={printCss(printedAt)} onDone={onDone}>
      <h1>[ 미납대장현황 {year}년 {"\u00a0"}{monthLabel}월 ]</h1>
      <table>
        <thead>
          <tr>
            <th style={{ width: "22%" }}>{"\u00a0"}</th>
            <th style={{ width: "9%" }}>동호</th>
            <th style={{ width: "10%" }}>년월</th>
            <th style={{ width: "4%" }}>cnt</th>
            <th style={{ width: "10%" }}>미납액</th>
            <th style={{ width: "11%" }}>납기내연체</th>
            <th style={{ width: "9%" }}>후연체</th>
            <th style={{ width: "10%" }}>연체료계</th>
            <th style={{ width: "8%" }}>예약일</th>
            <th style={{ width: "10%" }}>계</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows key={group.occupancyId} buildingName={buildingName} group={group} />
          ))}
          <tr className="tot">
            <td colSpan={4} className="c">합계 {"\u00a0"}{totals.unitCount} 건</td>
            <td className="r">{nz(totals.unpaid)}</td>
            <td className="r">{nz(totals.lateFee)}</td>
            <td className="r">{nz(totals.postLate)}</td>
            <td className="r">{nz(totals.lateTotal)}</td>
            <td />
            <td className="r">{nz(totals.total)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </PrintSheet>
  );
}

function GroupRows({
  buildingName,
  group,
}: {
  buildingName: string;
  group: OverdueDisplayGroup;
}) {
  return (
    <>
      {group.lines.map((line, index) => (
        <tr key={line.key}>
          <td>{index === 0 ? buildingName : ""}</td>
          <td className="c">{index === 0 ? group.unitLabel : ""}</td>
          <td className="c">{formatPeriodSlash(line.period)}</td>
          <td className="c">{line.overdueMonths}</td>
          <td className="r">{nz(line.unpaid)}</td>
          <td className="r">{nz(line.displayLateFee)}</td>
          <td className="r">{nz(line.postLate)}</td>
          <td className="r">{nz(line.lateTotal)}</td>
          <td />
          <td className="r">{nz(line.total)}</td>
          <td>{line.note || (index === 0 ? group.phone ?? "" : "")}</td>
        </tr>
      ))}
      <tr className="sub">
        <td />
        <td />
        <td className="c">[호합]</td>
        <td />
        <td className="r">{nz(group.rollup.unpaid)}</td>
        <td className="r">{nz(group.rollup.lateFee)}</td>
        <td className="r">{nz(group.rollup.postLate)}</td>
        <td className="r">{nz(group.rollup.lateTotal)}</td>
        <td />
        <td className="r">{nz(group.rollup.total)}</td>
        <td />
      </tr>
    </>
  );
}
