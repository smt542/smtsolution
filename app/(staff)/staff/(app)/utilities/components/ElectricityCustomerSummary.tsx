import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";

export interface ElectricityCustomerSummaryRow {
  id: number;
  customerNumber: string;
  chargeAmount: number;
  usage: number;
  unitPrice: number | null;
  currentReading: number;
  previousReading: number;
  meterDifference: number;
  movingCharge: number;
}

export interface ElectricityCustomerSummaryDraft {
  customerNumber: string;
  chargeAmount: string;
}

interface ElectricityCustomerSummaryProps {
  rows: ElectricityCustomerSummaryRow[];
  drafts: Record<number, ElectricityCustomerSummaryDraft>;
  editing: boolean;
  onDraftChange: (id: number, patch: Partial<ElectricityCustomerSummaryDraft>) => void;
}

const columns: { key: keyof ElectricityCustomerSummaryRow | "line"; label: string; align?: "right" }[] = [
  { key: "line", label: "L" },
  { key: "customerNumber", label: "고객번호" },
  { key: "chargeAmount", label: "부과액", align: "right" },
  { key: "usage", label: "량", align: "right" },
  { key: "unitPrice", label: "단가", align: "right" },
  { key: "currentReading", label: "금월량", align: "right" },
  { key: "previousReading", label: "전월량", align: "right" },
  { key: "meterDifference", label: "감면", align: "right" },
  { key: "movingCharge", label: "이사", align: "right" },
];

export function ElectricityCustomerSummary({
  rows,
  drafts,
  editing,
  onDraftChange,
}: ElectricityCustomerSummaryProps) {
  if (rows.length === 0) {
    return (
      <section className="flex h-[150px] flex-none flex-col items-center justify-center gap-[5px] rounded-[16px] bg-white px-6 pb-10 pt-[34px] text-center shadow-card">
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p>
        <p className="text-[13px] font-normal leading-[1.55] text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p>
      </section>
    );
  }

  return (
    <section className="h-[150px] flex-none overflow-hidden rounded-card bg-white shadow-card">
      <div className="h-full overflow-auto">
        <table className="w-[1294px] table-fixed border-collapse text-[13.5px]">
          <colgroup>
            {(editing
              ? [58, 300, 300, 82, 87, 90, 90, 107, 75]
              : [77, 230, 136, 110, 116, 120, 120, 144, 101]
            ).map((width, index) => <col key={index} style={{ width }} />)}
          </colgroup>
          <thead>
            <tr className="h-[36.5px] bg-[#fbfcfd] text-[12px] font-bold text-t3">
              {columns.map((column) => (
                <th key={column.key} className={`border-b border-line2 px-2 ${column.align === "right" ? "text-right" : "text-left"}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const draft = drafts[row.id] ?? {
                customerNumber: row.customerNumber,
                chargeAmount: String(row.chargeAmount),
              };
              return (
              <tr key={row.id} className={`border-b border-line2 last:border-b-0 ${editing ? "h-[51px]" : "h-[41px]"} ${!editing && rowIndex === 0 ? "bg-blue-t" : "bg-white hover:bg-blue-t2"}`}>
                <td className="px-4 text-right font-medium text-t1">{rowIndex + 1}</td>
                <td className="truncate px-4 font-bold text-t1">
                  {editing ? (
                    <input
                      aria-label={`${rowIndex + 1}번 고객번호`}
                      value={draft.customerNumber}
                      onChange={(event) => onDraftChange(row.id, { customerNumber: event.target.value })}
                      className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-[7px] text-[11.5px] font-bold text-t1 outline-none"
                    />
                  ) : row.customerNumber}
                </td>
                <td className="num px-4 text-right font-bold text-t1">
                  {editing ? (
                    <input
                      aria-label={`${row.customerNumber} 부과액`}
                      type="number"
                      value={draft.chargeAmount}
                      onChange={(event) => onDraftChange(row.id, { chargeAmount: event.target.value })}
                      className="num h-[26px] w-full rounded-[7px] border border-teal bg-white px-[7px] text-right text-[11.5px] font-bold text-t1 outline-none"
                    />
                  ) : formatNumber(row.chargeAmount)}
                </td>
                <td className="num px-2 text-right text-t2">{formatNumber(row.usage)}</td>
                <td className="num px-2 text-right text-t2">{row.unitPrice === null ? <GridEmptyValue /> : formatNumber(row.unitPrice, { fractionDigits: 1 })}</td>
                <td className="num px-2 text-right text-t2">{formatNumber(row.currentReading)}</td>
                <td className="num px-2 text-right text-t2">{formatNumber(row.previousReading)}</td>
                <td className={`num px-2 text-right font-semibold ${row.meterDifference < 0 ? "text-red" : "text-t2"}`}>
                  {formatNumber(row.meterDifference)}
                </td>
                <td className="num px-2 text-right text-t2">{row.movingCharge ? formatNumber(row.movingCharge) : <GridEmptyValue />}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
