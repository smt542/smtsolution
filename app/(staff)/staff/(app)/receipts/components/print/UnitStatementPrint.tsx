"use client";

import { PrintSheet } from "@/components/common/PrintSheet";
import type {
  UnitStatementFeeColumn,
  UnitStatementRow,
} from "../unit-statement/buildUnitStatementReport";

const PRINT_CSS = `
@page { size: A4 landscape; margin: 9mm; }
#rcStmtPrint * { box-sizing: border-box; }
#rcStmtPrint { margin: 0; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#rcStmtPrint h1 {
  text-align: center;
  font-size: 13pt;
  font-weight: 400;
  margin: 0 0 4mm;
  page-break-after: avoid;
  break-after: avoid;
}
#rcStmtPrint table {
  width: 100%;
  border-collapse: collapse;
  font-size: 7.2pt;
  table-layout: fixed;
  page-break-before: avoid;
  break-before: avoid;
}
#rcStmtPrint th, #rcStmtPrint td {
  border: 1px solid #000;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  vertical-align: top;
  font-weight: 400;
}
#rcStmtPrint th div, #rcStmtPrint td div {
  padding: .7mm 1.2mm;
  min-height: 3.6mm;
  border-bottom: 1px solid #D9D9D9;
}
#rcStmtPrint th div:last-child, #rcStmtPrint td div:last-child { border-bottom: none; }
#rcStmtPrint thead th { background: #EDEDED; text-align: center; }
#rcStmtPrint thead { display: table-header-group; }
#rcStmtPrint tbody { break-inside: auto; }
#rcStmtPrint td.c { text-align: center; }
#rcStmtPrint td.r { text-align: right; }
#rcStmtPrint tr { page-break-inside: avoid; }
#rcStmtPrint .sum {
  margin-top: 4mm;
  border-collapse: collapse;
  font-size: 8pt;
  page-break-before: avoid;
  break-before: avoid;
  page-break-inside: avoid;
}
#rcStmtPrint .sum td {
  border: 1px solid #C00;
  padding: 1.2mm 4mm;
  color: #C00;
  text-align: right;
  font-weight: 400;
}
#rcStmtPrint .sum td.l { text-align: center; background: #FFF8F8; }
`;

function nz(value: number | null | undefined): string {
  return value ? value.toLocaleString("ko-KR") : "";
}

function sumFormat(value: number): string {
  return value.toLocaleString("ko-KR");
}

function ThreeLines({ values }: { values: Array<string | null | undefined> }) {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <div key={index}>{values[index] ?? ""}</div>
      ))}
    </>
  );
}

function FeeHeader({ column }: { column: UnitStatementFeeColumn }) {
  return <ThreeLines values={[column.labels[0], column.labels[1], column.labels[2]]} />;
}

export function UnitStatementPrint({
  buildingName,
  titleUnitLabel,
  rows,
  feeColumns,
  totals,
  onDone,
}: {
  buildingName: string;
  titleUnitLabel: string;
  rows: UnitStatementRow[];
  feeColumns: UnitStatementFeeColumn[];
  totals: { unpaid: number; lateFee: number; total: number };
  onDone: () => void;
}) {
  return (
    <PrintSheet id="rcStmtPrint" css={PRINT_CSS} onDone={onDone}>
      <h1>
        [{" "}
        {buildingName}
        {"\u00a0"}
        {titleUnitLabel}]
      </h1>
      <table>
        <thead>
          <tr>
            <th><ThreeLines values={["년 월", "", "수납일"]} /></th>
            <th><ThreeLines values={["당월계", "연체료", "수납액"]} /></th>
            <th><ThreeLines values={["전기금액", "수도금액", "가스금액"]} /></th>
            <th><ThreeLines values={["금월", "전월", "량"]} /></th>
            <th><ThreeLines values={["단가", "", ""]} /></th>
            {feeColumns.map((column) => (
              <th key={column.key}><FeeHeader column={column} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="a">
              <td className="c">
                <ThreeLines values={[row.periodLabel, "", row.paymentDateLabel]} />
              </td>
              <td className="r">
                <ThreeLines values={[nz(row.charged), nz(row.lateFee), nz(row.paid)]} />
              </td>
              <td className="r">
                <ThreeLines values={row.utilityAmounts.map(nz)} />
              </td>
              <td className="r">
                <ThreeLines values={row.meterReadings.map(nz)} />
              </td>
              <td className="r">
                <ThreeLines values={[nz(row.unitPrice), "", ""]} />
              </td>
              {feeColumns.map((column, index) => (
                <td className="r" key={column.key}>
                  <ThreeLines values={[0, 1, 2].map((line) => nz(row.feeValues[index]?.[line]))} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <table className="sum">
        <tbody>
          <tr>
            <td className="l">미납액</td>
            <td>{sumFormat(totals.unpaid)}</td>
            <td className="l">연체료</td>
            <td>{sumFormat(totals.lateFee)}</td>
            <td className="l">미납합계</td>
            <td>{sumFormat(totals.total)}</td>
          </tr>
        </tbody>
      </table>
    </PrintSheet>
  );
}
