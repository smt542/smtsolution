import { formatWon } from "@/lib/format";
import type { Building } from "@/hooks/reactquery/buildings";
import type { StatementRow } from "./statement";

interface ChargeStatementDocumentProps {
  building: Building;
  companyName: string;
  year: number;
  month: number;
  feeNames: string[];
  rows: StatementRow[];
  pageIndex: number; // 0-based
  pageCount: number;
  totals?: number[]; // 마지막 페이지에만 합계 행 표시
  grandTotal?: number;
}

const CELL = "border border-[#c9ced4] px-[6px] py-[6px] text-[10.5px]";

/** 관리비부과내역서 A4 시트 한 페이지 — 세대(행)×항목(열) 표. 미리보기·인쇄 공용. */
export function ChargeStatementDocument({
  building,
  companyName,
  year,
  month,
  feeNames,
  rows,
  pageIndex,
  pageCount,
  totals,
  grandTotal,
}: ChargeStatementDocumentProps) {
  const showTotals = totals != null && grandTotal != null;
  return (
    <div className="relative mx-auto min-h-[270mm] w-[190mm] overflow-hidden bg-white p-[14mm] text-[#191f28] shadow-sm print:break-after-page print:shadow-none">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rotate-[-24deg] whitespace-nowrap text-[68px] font-extrabold text-black/5">{companyName}</span>
      </div>
      <div className="relative">
        <h1 className="text-center text-[19px] font-extrabold">관리비 부과내역서</h1>
        <p className="mt-[4mm] text-center text-[12px] font-bold">
          [ {building.name} ] {year}년 {month}월분
        </p>
        <table className="mt-[6mm] w-full border-collapse">
          <thead>
            <tr className="bg-[#f4f6f8]">
              <th className={`${CELL} font-bold`}>호 수</th>
              <th className={`${CELL} font-bold`}>입주자</th>
              {feeNames.map((name) => (
                <th key={name} className={`${CELL} font-bold`}>{name}</th>
              ))}
              <th className={`${CELL} font-bold`}>합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.unitId}>
                <td className={`${CELL} text-center`}>{row.unitNo}</td>
                <td className={CELL}>{row.tenantName?.trim() || "-"}</td>
                {row.cells.map((amount, index) => (
                  <td key={feeNames[index] ?? index} className={`${CELL} text-right`}>
                    {amount ? formatWon(amount) : "-"}
                  </td>
                ))}
                <td className={`${CELL} text-right font-bold`}>{formatWon(row.total)}</td>
              </tr>
            ))}
            {showTotals && (
              <tr className="bg-[#f4f6f8] font-bold">
                <td className={`${CELL} text-center`} colSpan={2}>합계</td>
                {totals.map((amount, index) => (
                  <td key={feeNames[index] ?? index} className={`${CELL} text-right`}>{formatWon(amount)}</td>
                ))}
                <td className={`${CELL} text-right`}>{formatWon(grandTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-[10mm] text-center text-[11px] text-[#8b95a1]">
          {building.name} · {year}년 {month}월 기준 · {pageIndex + 1} / {pageCount} 쪽
        </p>
      </div>
    </div>
  );
}
