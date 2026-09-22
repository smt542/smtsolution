import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";

interface UtilityAccountSummaryProps {
  rows: UtilityUnitRow[];
  selectedRow: UtilityUnitRow | null;
  editing: boolean;
  onSelect: (row: UtilityUnitRow) => void;
}

const COLUMN_WIDTHS = [34, 104, 48, 48, 70, 74, 76, 76, 62, 58, 66, 62, 62, 62];
const TABLE_MIN_WIDTH = COLUMN_WIDTHS.reduce((total, width) => total + width, 0);
const REFERENCE_FONT = "Pretendard, -apple-system, system-ui, sans-serif";
const HEADINGS = [
  "L", "고객번호", "월", "량", "수동입력", "할인금액", "전월금액", "부과액",
  "전단가", "단가", "금-전1", "금-전2", "금월량", "전월량",
];

function sum(rows: UtilityUnitRow[], key: keyof UtilityUnitRow): number {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function display(value: number, hasValue = true): string {
  return hasValue && value !== 0 ? formatNumber(value) : "-";
}

export function UtilityAccountSummary({
  rows,
  selectedRow,
  editing,
  onSelect,
}: UtilityAccountSummaryProps) {
  const groups = new Map<string, UtilityUnitRow[]>();
  rows.forEach((row) => {
    const key = row.customerNumber ?? "미등록";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return (
    <section className="h-[150px] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="h-full overflow-auto">
        <table className="w-full table-fixed border-collapse whitespace-nowrap text-[11.5px]" style={{ minWidth: TABLE_MIN_WIDTH, fontFamily: REFERENCE_FONT }} aria-label="수도 고객번호 요약">
          <colgroup>
            {COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 h-[37px] bg-[#FBFCFD] text-[11.5px] font-bold text-t3">
            <tr className="border-b border-line">
              {HEADINGS.map((heading, index) => <th key={heading} className={`px-3 ${index === 1 || index === 2 ? "text-left" : "text-right"}`}>{heading}</th>)}
            </tr>
          </thead>
          <tbody className="text-[11.5px] font-normal text-t1">
            {[...groups.entries()].map(([customerNumber, group], index) => {
              const anchor = group[0];
              const selected = group.some((row) => row.unitId === selectedRow?.unitId);
              const charge = sum(group, "automaticCharge");
              const manual = sum(group, "manualCharge");
              const discount = sum(group, "discountAmount");
              const usage = sum(group, "usage");
              const previousUsage = sum(group, "previousUsage");
              const hasManual = group.some((row) => row.manualCharge !== null);
              return (
                <tr
                  key={customerNumber}
                  onClick={() => onSelect(anchor)}
                  className={`h-[35px] cursor-pointer border-b border-line2 ${selected ? "bg-blue-t" : "bg-white hover:bg-blue-t2"}`}
                >
                  <td className="px-3 text-right text-t2">{index + 1}</td>
                  <td className="px-3 font-bold text-t1">
                    {editing ? (
                      <input aria-label={`${customerNumber} 고객번호`} value={customerNumber} readOnly className="h-[26px] w-[92px] rounded-md border border-teal bg-white px-2 text-[11px] outline-none" />
                    ) : customerNumber}
                  </td>
                  <td className="px-3 text-left text-t2">당월</td>
                  <td className="num px-3 text-right text-t2">{formatNumber(usage)}</td>
                  <td className="num px-3 text-right text-t2">{display(manual, hasManual)}</td>
                  <td className="num px-3 text-right font-semibold text-red">{discount ? `-${formatNumber(discount)}` : "-"}</td>
                  <td className="num px-3 text-right text-t3">-</td>
                  <td className="num px-3 text-right font-bold text-t1">
                    {editing ? (
                      <input aria-label={`${customerNumber} 부과액`} value={manual || charge || ""} readOnly className="h-[26px] w-[64px] rounded-md border border-teal bg-white px-2 text-right text-[11px] outline-none" />
                    ) : formatNumber(manual || charge)}
                  </td>
                  <td className="num px-3 text-right text-t3">-</td>
                  <td className="num px-3 text-right font-semibold text-t2">
                    {(anchor.unitPrice ?? anchor.resolvedUnitPrice) ? formatNumber(anchor.unitPrice ?? anchor.resolvedUnitPrice) : <GridEmptyValue />}
                  </td>
                  <td className="num px-3 text-right text-t3">-</td>
                  <td className="num px-3 text-right text-t3">-</td>
                  <td className="num px-3 text-right text-t2">{formatNumber(usage)}</td>
                  <td className="num px-3 text-right font-medium text-t2">{formatNumber(previousUsage)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={14} className="h-[96px] text-center text-[13px] text-t3">등록된 고객번호가 없어요.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
