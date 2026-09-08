import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";

interface UtilityAccountSummaryProps {
  rows: UtilityUnitRow[];
  selectedRow: UtilityUnitRow | null;
  editing: boolean;
  onSelect: (row: UtilityUnitRow) => void;
}

function sum(rows: UtilityUnitRow[], key: keyof UtilityUnitRow): number {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
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
    <section className="h-[150px] shrink-0 overflow-hidden rounded-xl border border-line bg-white">
      <div className="h-full overflow-auto">
        <table className="w-full min-w-[1120px] table-fixed border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-[#FBFCFD] text-t3">
            <tr className="h-[42px] border-b border-line2">
              <th className="w-8 px-2 text-center font-semibold">L</th>
              <th className="w-[105px] px-2 text-left font-semibold">고객번호</th>
              <th className="w-14 px-2 text-right font-semibold">월</th>
              <th className="w-14 px-2 text-right font-semibold">량</th>
              <th className="w-[72px] px-2 text-right font-semibold">수동입력</th>
              <th className="w-[72px] px-2 text-right font-semibold">할인금액</th>
              <th className="w-[72px] px-2 text-right font-semibold">전월금액</th>
              <th className="w-[72px] px-2 text-right font-semibold">부과액</th>
              <th className="w-[65px] px-2 text-right font-semibold">전단가</th>
              <th className="w-[65px] px-2 text-right font-semibold">단가</th>
              <th className="w-[70px] px-2 text-right font-semibold">금-전1</th>
              <th className="w-[70px] px-2 text-right font-semibold">금-전2</th>
              <th className="w-[70px] px-2 text-right font-semibold">금월량</th>
              <th className="w-[70px] px-2 text-right font-semibold">전월량</th>
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
              return (
                <tr
                  key={customerNumber}
                  onClick={() => onSelect(anchor)}
                  className={`h-[42px] cursor-pointer border-b border-line2 ${selected ? "bg-[#E2F5F1]" : "hover:bg-bg"}`}
                >
                  <td className="px-2 text-center font-bold text-t2">{index + 1}</td>
                  <td className="px-2 font-bold text-t1">
                    {editing ? (
                      <input aria-label={`${customerNumber} 고객번호`} value={customerNumber} readOnly className="h-[26px] w-[92px] rounded-md border border-teal bg-white px-2 text-[11px] outline-none" />
                    ) : customerNumber}
                  </td>
                  <td className="num px-2 text-right text-t2">{group.length}</td>
                  <td className="num px-2 text-right text-t2">{formatNumber(usage)}</td>
                  <td className="num px-2 text-right text-t2">{formatNumber(manual)}</td>
                  <td className="num px-2 text-right text-t2">{formatNumber(discount)}</td>
                  <td className="num px-2 text-right text-t3">-</td>
                  <td className="num px-2 text-right font-bold text-t1">
                    {editing ? (
                      <input aria-label={`${customerNumber} 부과액`} value={manual || charge || ""} readOnly className="h-[26px] w-[64px] rounded-md border border-teal bg-white px-2 text-right text-[11px] outline-none" />
                    ) : formatNumber(manual || charge)}
                  </td>
                  <td className="num px-2 text-right text-t3">-</td>
                  <td className="num px-2 text-right text-t2">
                    {(anchor.unitPrice ?? anchor.resolvedUnitPrice) ? formatNumber(anchor.unitPrice ?? anchor.resolvedUnitPrice) : <GridEmptyValue />}
                  </td>
                  <td className="num px-2 text-right text-t3">-</td>
                  <td className="num px-2 text-right text-t3">-</td>
                  <td className="num px-2 text-right text-t2">{formatNumber(sum(group, "currentReading"))}</td>
                  <td className="num px-2 text-right text-t2">{formatNumber(sum(group, "previousReading"))}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={14} className="h-[96px] text-center text-[12px] text-t3">등록된 고객번호가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
