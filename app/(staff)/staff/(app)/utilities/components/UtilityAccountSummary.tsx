import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";

interface UtilityAccountSummaryProps {
  rows: UtilityUnitRow[];
  selectedRow: UtilityUnitRow | null;
  editing: boolean;
  onSelect: (row: UtilityUnitRow) => void;
}

const REFERENCE_FONT = "Pretendard, -apple-system, system-ui, sans-serif";
const COLUMNS: { label: string; minWidth: number; align: "left" | "right" }[] = [
  { label: "L", minWidth: 34, align: "right" },
  { label: "고객번호", minWidth: 104, align: "left" },
  { label: "월", minWidth: 48, align: "left" },
  { label: "량", minWidth: 48, align: "right" },
  { label: "수동입력", minWidth: 70, align: "right" },
  { label: "할인금액", minWidth: 74, align: "right" },
  { label: "전월금액", minWidth: 76, align: "right" },
  { label: "부과액", minWidth: 76, align: "right" },
  { label: "전단가", minWidth: 62, align: "right" },
  { label: "단가", minWidth: 58, align: "right" },
  { label: "금-전1", minWidth: 66, align: "right" },
  { label: "금-전2", minWidth: 62, align: "right" },
  { label: "금월량", minWidth: 62, align: "right" },
  { label: "전월량", minWidth: 62, align: "right" },
];

const cellClass = "px-4 whitespace-nowrap";
const dashClass = "num px-4 whitespace-nowrap text-right text-t3";
const inputClass = "h-[26px] rounded-[7px] border border-teal bg-white px-[7px] text-[11.5px] font-bold text-t1 outline-none focus:ring-1 focus:ring-teal/20";

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
        <table className="w-full border-collapse whitespace-nowrap" style={{ fontFamily: REFERENCE_FONT }} aria-label="수도 고객번호 요약">
          <thead className="sticky top-0 z-10 h-[37px] bg-[#FBFCFD] text-[12px] font-bold text-t3">
            <tr className="border-b border-line">
              {COLUMNS.map(({ label, minWidth, align }) => (
                <th key={label} style={{ minWidth }} className={`px-4 ${align === "right" ? "text-right" : "text-left"}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[13.5px] font-medium text-t1">
            {[...groups.entries()].map(([customerNumber, group], index) => {
              const anchor = group[0];
              const selected = group.some((row) => row.unitId === selectedRow?.unitId);
              const charge = sum(group, "automaticCharge");
              const manual = sum(group, "manualCharge");
              const discount = sum(group, "discountAmount");
              const usage = sum(group, "usage");
              const previousUsage = sum(group, "previousUsage");
              const hasManual = group.some((row) => row.manualCharge !== null);
              const manualText = display(manual, hasManual);
              const unitPrice = anchor.unitPrice ?? anchor.resolvedUnitPrice;
              return (
                <tr
                  key={customerNumber}
                  onClick={() => onSelect(anchor)}
                  className={`${editing ? "h-[51px]" : "h-[41px]"} cursor-pointer border-b border-line2 ${selected ? "bg-blue-t" : "bg-white hover:bg-blue-t2"}`}
                >
                  <td className={`${cellClass} num text-right`}>{index + 1}</td>
                  <td className={`${cellClass} font-bold`}>
                    {editing ? (
                      <input aria-label={`${customerNumber} 고객번호`} value={customerNumber} readOnly className={`${inputClass} w-[92px]`} />
                    ) : customerNumber}
                  </td>
                  <td className={`${cellClass} text-left`}>당월</td>
                  <td className={`${cellClass} num text-right`}>{formatNumber(usage)}</td>
                  <td className={manualText === "-" ? dashClass : `${cellClass} num text-right`}>{manualText}</td>
                  <td className={discount ? `${cellClass} num text-right font-semibold text-red` : dashClass}>{discount ? `-${formatNumber(discount)}` : "-"}</td>
                  <td className={dashClass}>-</td>
                  <td className={`${cellClass} num text-right font-bold`}>
                    {editing ? (
                      <input aria-label={`${customerNumber} 부과액`} value={manual || charge || ""} readOnly className={`${inputClass} w-[64px] text-right`} />
                    ) : formatNumber(manual || charge)}
                  </td>
                  <td className={dashClass}>-</td>
                  <td className={unitPrice ? `${cellClass} num text-right font-semibold` : dashClass}>
                    {unitPrice ? formatNumber(unitPrice) : <GridEmptyValue />}
                  </td>
                  <td className={dashClass}>-</td>
                  <td className={dashClass}>-</td>
                  <td className={`${cellClass} num text-right`}>{formatNumber(usage)}</td>
                  <td className={`${cellClass} num text-right`}>{formatNumber(previousUsage)}</td>
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
