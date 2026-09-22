import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";

interface UtilityAccountSummaryProps {
  rows: UtilityUnitRow[];
  selectedRow: UtilityUnitRow | null;
  editing: boolean;
  onSelect: (row: UtilityUnitRow) => void;
}

const COLUMN_WIDTHS = [43, 224, 59, 61, 78, 90, 83, 224, 74, 75, 83, 69, 67, 67];
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
    <section className="h-[150px] shrink-0 overflow-x-auto rounded-[16px] bg-white shadow-card">
      <div className="h-full overflow-y-hidden">
        <table className="w-[1294px] table-fixed border-collapse text-[11.5px]" aria-label="수도 고객번호 요약">
          <colgroup>
            {COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 h-[37px] bg-[#FBFCFD] text-t3">
            <tr className="border-b border-line">
              {HEADINGS.map((heading, index) => <th key={heading} className={`border-r border-line2 px-4 text-[12px] font-bold last:border-r-0 ${index === 1 ? "text-left" : "text-right"}`}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()].map(([customerNumber, group], index) => {
              const anchor = group[0];
              const selected = group.some((row) => row.unitId === selectedRow?.unitId);
              const charge = sum(group, "automaticCharge");
              const manual = sum(group, "manualCharge");
              const discount = sum(group, "discountAmount");
              const usage = sum(group, "usage");
              const hasManual = group.some((row) => row.manualCharge !== null);
              return (
                <tr
                  key={customerNumber}
                  onClick={() => onSelect(anchor)}
                  className={`${editing ? "h-[51px]" : "h-[41px]"} cursor-pointer border-b border-line2 ${selected ? "bg-blue-t" : "bg-white hover:bg-blue-t2"}`}
                >
                  <td className="border-r border-line2 px-4 text-right font-bold text-t2">{index + 1}</td>
                  <td className="border-r border-line2 px-4 font-bold text-t1">
                    {editing ? (
                      <input aria-label={`${customerNumber} 고객번호`} value={customerNumber} readOnly className="h-[26px] w-[92px] rounded-md border border-teal bg-white px-2 text-[11px] outline-none" />
                    ) : customerNumber}
                  </td>
                  <td className="border-r border-line2 px-4 text-right text-t2">당월</td>
                  <td className="num border-r border-line2 px-4 text-right text-t2">{formatNumber(usage)}</td>
                  <td className="num border-r border-line2 px-4 text-right text-t2">{display(manual, hasManual)}</td>
                  <td className="num border-r border-line2 px-4 text-right text-red">{discount ? `-${formatNumber(discount)}` : "-"}</td>
                  <td className="num border-r border-line2 px-4 text-right text-t3">-</td>
                  <td className="num border-r border-line2 px-4 text-right font-bold text-t1">
                    {editing ? (
                      <input aria-label={`${customerNumber} 부과액`} value={manual || charge || ""} readOnly className="h-[26px] w-[64px] rounded-md border border-teal bg-white px-2 text-right text-[11px] outline-none" />
                    ) : formatNumber(manual || charge)}
                  </td>
                  <td className="num border-r border-line2 px-4 text-right text-t3">-</td>
                  <td className="num border-r border-line2 px-4 text-right text-t2">
                    {(anchor.unitPrice ?? anchor.resolvedUnitPrice) ? formatNumber(anchor.unitPrice ?? anchor.resolvedUnitPrice) : <GridEmptyValue />}
                  </td>
                  <td className="num border-r border-line2 px-4 text-right text-t3">-</td>
                  <td className="num border-r border-line2 px-4 text-right text-t3">-</td>
                  <td className="num border-r border-line2 px-4 text-right text-t2">{formatNumber(sum(group, "currentReading"))}</td>
                  <td className="num px-4 text-right text-t2">{formatNumber(sum(group, "previousReading"))}</td>
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
