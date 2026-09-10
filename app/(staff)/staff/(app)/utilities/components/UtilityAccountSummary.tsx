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
    <section className="h-[150px] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="h-full overflow-auto">
        <table className="w-full min-w-[1120px] table-fixed border-collapse text-[13.5px]">
          <thead className="sticky top-0 z-10 bg-[#FBFCFD] text-t3">
            <tr className="h-[37px] border-b border-line">
              <th className="w-8 px-4 text-right text-[12px] font-bold">L</th>
              <th className="w-[105px] px-4 text-left text-[12px] font-bold">고객번호</th>
              <th className="w-14 px-4 text-right text-[12px] font-bold">월</th>
              <th className="w-14 px-4 text-right text-[12px] font-bold">량</th>
              <th className="w-[72px] px-4 text-right text-[12px] font-bold">수동입력</th>
              <th className="w-[72px] px-4 text-right text-[12px] font-bold">할인금액</th>
              <th className="w-[72px] px-4 text-right text-[12px] font-bold">전월금액</th>
              <th className="w-[72px] px-4 text-right text-[12px] font-bold">부과액</th>
              <th className="w-[65px] px-4 text-right text-[12px] font-bold">전단가</th>
              <th className="w-[65px] px-4 text-right text-[12px] font-bold">단가</th>
              <th className="w-[70px] px-4 text-right text-[12px] font-bold">금-전1</th>
              <th className="w-[70px] px-4 text-right text-[12px] font-bold">금-전2</th>
              <th className="w-[70px] px-4 text-right text-[12px] font-bold">금월량</th>
              <th className="w-[70px] px-4 text-right text-[12px] font-bold">전월량</th>
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
                  className={`${editing ? "h-[51px]" : "h-[41px]"} cursor-pointer border-b border-line2 ${selected ? "bg-blue-t" : "hover:bg-blue-t2"}`}
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
              <tr><td colSpan={14} className="h-[96px] text-center text-[13px] text-t3">등록된 고객번호가 없어요.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
