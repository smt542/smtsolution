"use client";

import { PrintSheet } from "@/components/common/PrintSheet";
import type {
  VillaReceiptReportRow,
} from "../villa-receipts/buildVillaReceiptReport";

function nz(value: number | null | undefined): string {
  return value ? value.toLocaleString("ko-KR") : "";
}

const PRINT_CSS = `
@page { size: A4 portrait; margin: 14mm; }
#rcPaidPrint * { box-sizing: border-box; }
#rcPaidPrint { margin: 0; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#rcPaidPrint h1 { font-size: 13pt; font-weight: 700; margin: 0 0 4mm; }
#rcPaidPrint table { width: 100%; border-collapse: collapse; font-size: 9pt; }
#rcPaidPrint th, #rcPaidPrint td { border: 1px solid #000; padding: 1.4mm 2mm; white-space: nowrap; }
#rcPaidPrint thead th { background: #EDEDED; text-align: center; font-weight: 700; }
#rcPaidPrint thead { display: table-header-group; }
#rcPaidPrint tbody { break-inside: auto; }
#rcPaidPrint td.c { text-align: center; }
#rcPaidPrint td.r { text-align: right; }
#rcPaidPrint tr { page-break-inside: avoid; }
#rcPaidPrint tr.g > td { border-top: 1.4px solid #000; }
#rcPaidPrint tr.g > td:first-child { font-weight: 700; }
#rcPaidPrint tfoot { display: table-footer-group; }
#rcPaidPrint tfoot tr.t > td { background: #E8E8E8; font-weight: 700; }
`;

export function VillaReceiptHistoryPrint({
  buildingName,
  address,
  rows,
  totals,
  onDone,
}: {
  buildingName: string;
  address: string | null;
  rows: VillaReceiptReportRow[];
  totals: { charged: number; paid: number };
  onDone: () => void;
}) {
  return (
    <PrintSheet id="rcPaidPrint" css={PRINT_CSS} onDone={onDone}>
      <h1>{`${address ?? ""} ${buildingName}`}</h1>
      <table>
        <thead>
          <tr>
            <th style={{ width: "8%" }}>호수</th>
            <th style={{ width: "12%" }}>년{"\u00a0\u00a0"}월</th>
            <th style={{ width: "13%" }}>당월계</th>
            <th style={{ width: "13%" }}>수납액</th>
            <th style={{ width: "16%" }}>수납일자</th>
            <th style={{ width: "11%" }}>은행</th>
            <th style={{ width: "7%" }}>chk</th>
            <th style={{ width: "4%" }}>C</th>
            <th>비{"\u00a0\u00a0"}고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.showUnit ? "g" : undefined}>
              <td className="c">{row.showUnit ? row.unitLabel : ""}</td>
              <td className="c">{row.periodLabel}</td>
              <td className="r">{nz(row.charged)}</td>
              <td className="r">{nz(row.paid)}</td>
              <td className="c">{row.paidAtLabel}</td>
              <td className="c">{row.methodLabel}</td>
              <td className="c">{row.kindLabel}</td>
              <td className="c" />
              <td>{row.memo}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="t">
            <td className="c">합계</td>
            <td />
            <td className="r">{nz(totals.charged)}</td>
            <td className="r">{nz(totals.paid)}</td>
            <td colSpan={5} />
          </tr>
        </tfoot>
      </table>
    </PrintSheet>
  );
}
