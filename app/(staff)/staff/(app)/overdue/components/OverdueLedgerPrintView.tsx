import { Fragment } from "react";
import {
  buildOverdueGroups,
  formatOverduePeriod,
  formatOverdueUnit,
  sumOverdueGroups,
} from "./overdueRowModel";
import type { OverdueHousehold, OverduePeriodRow } from "@/hooks/reactquery/overdue";

/**
 * 미납관리 출력물. 정본 `overdue-management.dc.html` 의 `#ovPrint` 핸들러가 만드는
 * `#ovPrintSheet` 시트를 그대로 옮겼다(A4 세로·여백 12mm·8.5pt·검정 1px 격자).
 *
 * ⚠️ 정본은 배경 음영을 브라우저 "배경 그래픽" 인쇄 옵션에 맡기지만, 앱은 옵션과
 * 무관하게 같은 출력물이 나와야 하므로 음영 셀에 print-color-adjust 를 건다
 * (저장소 선례: components/shell/as-rail/AsReportModal.tsx).
 */
const OVL_CSS = `
@page{size:A4 portrait;margin:12mm}
@media print{html,body{background:#fff}}
.ovl-title{
  margin:0 0 4mm;
  text-align:center;
  font-size:14pt;
  font-weight:700;
  text-decoration:underline;
  page-break-after:avoid;
  break-after:avoid;
}
.ovl-table{
  width:100%;
  border-collapse:collapse;
  font-size:8.5pt;
  page-break-inside:auto;
  break-inside:auto;
}
.ovl-table th,
.ovl-table td{
  border:1px solid #000;
  padding:1.1mm 1.6mm;
  white-space:nowrap;
}
.ovl-table thead{display:table-header-group}
.ovl-table tr{page-break-inside:avoid;break-inside:avoid}
.ovl-table thead th{
  background:#EDEDED;
  text-align:center;
  font-weight:700;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
.ovl-table td.c{text-align:center}
.ovl-table td.r{text-align:right}
.ovl-table tr.sub>td{
  background:#F2F2F2;
  font-weight:700;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
.ovl-table tr.tot>td{
  background:#E8E8E8;
  font-weight:700;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
`;

/** 정본 11개 컬럼. 화면에 있는 "비고"는 출력물에 넣지 않는다. */
const COLUMNS = [
  "동호", "거래처명", "년월", "연체", "미납액",
  "납.연체료", "납.후연체", "연체료계", "합계", "전화", "이름",
] as const;

/** 정본 `nz()` — 0은 빈칸으로 둔다. */
function nz(value: number): string {
  return value ? value.toLocaleString("ko-KR") : "";
}

interface OverdueLedgerPrintViewProps {
  year: number;
  month: number;
  rows: OverdueHousehold[];
  periods: OverduePeriodRow[];
}

export function OverdueLedgerPrintView({
  year,
  month,
  rows,
  periods,
}: OverdueLedgerPrintViewProps) {
  const groups = buildOverdueGroups(rows, periods);
  const totals = sumOverdueGroups(groups);

  return (
    <div className="hidden bg-white text-black leading-[normal] print:block" data-testid="overdue-ledger-print-root">
      <style>{OVL_CSS}</style>
      <h1 className="ovl-title">
        [ 미납관리 현황 {year}년 {String(month).padStart(2, "0")}월 ]
      </h1>
      <table className="ovl-table">
        <thead>
          <tr>{COLUMNS.map((label) => <th key={label}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const unit = formatOverdueUnit(group.household);
            return (
              <Fragment key={group.household.occupancyId}>
                {group.lines.map((line, index) => (
                  <tr key={line.key}>
                    {/* 정본은 동호·거래처명·전화·이름을 세대의 첫 줄에만 찍는다. */}
                    <td className="c">{index === 0 ? unit : ""}</td>
                    <td>{index === 0 ? group.household.buildingName : ""}</td>
                    <td className="c">{line.period === "-" ? "-" : formatOverduePeriod(line.period)}</td>
                    <td className="c">{line.months}</td>
                    <td className="r">{nz(line.principal)}</td>
                    <td className="r">{nz(line.lateFee)}</td>
                    <td className="r">{nz(line.postDueFee)}</td>
                    <td className="r">{nz(line.lateFee + line.postDueFee)}</td>
                    <td className="r">{nz(line.principal + line.lateFee + line.postDueFee)}</td>
                    <td className="c">{index === 0 ? group.household.phone ?? "" : ""}</td>
                    <td>{index === 0 ? group.household.tenantName ?? "" : ""}</td>
                  </tr>
                ))}
                <tr className="sub">
                  <td />
                  <td />
                  <td className="c">[호합]</td>
                  <td />
                  <td className="r">{nz(group.principal)}</td>
                  <td className="r">{nz(group.lateFee)}</td>
                  <td className="r">{nz(group.postDueFee)}</td>
                  <td className="r">{nz(group.lateFee + group.postDueFee)}</td>
                  <td className="r">{nz(group.principal + group.lateFee + group.postDueFee)}</td>
                  <td />
                  <td />
                </tr>
              </Fragment>
            );
          })}
          <tr className="tot">
            <td className="c" colSpan={4}>합계 {totals.lineCount} 건</td>
            <td className="r">{nz(totals.principal)}</td>
            <td className="r">{nz(totals.lateFee)}</td>
            <td className="r">{nz(totals.postDueFee)}</td>
            <td className="r">{nz(totals.lateFee + totals.postDueFee)}</td>
            <td className="r">{nz(totals.principal + totals.lateFee + totals.postDueFee)}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
