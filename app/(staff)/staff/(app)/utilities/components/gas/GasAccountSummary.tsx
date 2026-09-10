import type { GasTableRow, GasUtilityDraft } from "./types";

interface GasAccountSummaryProps {
  rows: GasTableRow[];
  drafts: Record<number, GasUtilityDraft>;
  editing: boolean;
}

interface GasAccountLine {
  customerNumber: string;
  usage: number;
  manualCharge: number | null;
  discountAmount: number;
  charge: number;
  unitPrice: number | null;
  currentReading: number;
  previousReading: number;
}

const COLUMN_WIDTHS = [43, 224, 59, 61, 78, 90, 83, 224, 74, 75, 83, 69, 67, 67];
const HEADINGS = [
  "L", "고객번호", "월", "량", "수동입력", "할인금액", "전월금액", "부과액",
  "전단가", "단가", "금-전1", "금-전2", "금월량", "전월량",
];

function numeric(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function display(value: number | null, suffix = ""): string {
  return value === null ? "-" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 3 })}${suffix}`;
}

function summarize(rows: GasTableRow[], drafts: Record<number, GasUtilityDraft>): GasAccountLine[] {
  const groups = new Map<string, GasTableRow[]>();
  rows.forEach((row) => {
    const key = row.customerNumber ?? "미지정";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups, ([customerNumber, groupRows]) => groupRows.reduce<GasAccountLine>(
    (line, row) => {
      const draft = drafts[row.unitId];
      const current = numeric(draft?.currentReading ?? "") ?? row.currentReading ?? row.previousReading ?? 0;
      const previous = row.previousReading ?? 0;
      const usage = row.fixedUsage ?? Math.max(0, current - previous);
      const manual = numeric(draft?.manualCharge ?? "");
      line.usage += usage;
      line.currentReading += current;
      line.previousReading += previous;
      line.discountAmount += row.discountAmount ?? 0;
      line.charge += manual ?? row.automaticCharge ?? usage * (row.resolvedUnitPrice ?? 0);
      if (manual !== null) line.manualCharge = (line.manualCharge ?? 0) + manual;
      if (line.unitPrice === null) line.unitPrice = row.resolvedUnitPrice;
      return line;
    },
    {
      customerNumber,
      usage: 0,
      manualCharge: null,
      discountAmount: 0,
      charge: 0,
      unitPrice: null,
      currentReading: 0,
      previousReading: 0,
    },
  ));
}

export function GasAccountSummary({ rows, drafts, editing }: GasAccountSummaryProps) {
  const lines = summarize(rows, drafts);

  return (
    <section aria-label="가스 고객번호 요약" className="h-[150px] shrink-0 overflow-x-auto rounded-2xl bg-white shadow-card">
      <table className="w-[1294px] table-fixed border-collapse text-center">
        <colgroup>
          {COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}
        </colgroup>
        <thead className="h-[37px] bg-[#FBFCFD] text-[12px] font-bold text-t3">
          <tr className="border-b border-line">
            {HEADINGS.map((heading, index) => <th key={heading} className={`border-r border-line2 px-4 last:border-r-0 ${index === 1 ? "text-left" : "text-right"}`}>{heading}</th>)}
          </tr>
        </thead>
        <tbody className="text-[13.5px] font-medium text-t1">
          {lines.map((line, index) => (
            <tr key={line.customerNumber} className={`${editing ? "h-[51px] bg-white hover:bg-blue-t2" : "h-[41px] bg-blue-t"} border-b border-line2`}>
              <td className="px-4 text-right">{index + 1}</td>
              <td className="px-4 text-left font-bold">
                {editing ? (
                  <input aria-label={`${line.customerNumber} 고객번호`} readOnly value={line.customerNumber} className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-2 text-[11.5px] font-semibold text-t2 outline-none" />
                ) : line.customerNumber}
              </td>
              <td className="px-4 text-right">당월</td>
              <td className="px-4 text-right tabular-nums">{display(line.usage)}</td>
              <td className="px-4 text-right tabular-nums">{display(line.manualCharge)}</td>
              <td className="px-4 text-right tabular-nums text-red">{line.discountAmount ? `-${display(line.discountAmount)}` : "-"}</td>
              <td className="px-4 text-right text-t3">-</td>
              <td className="px-4 text-right">
                {editing ? (
                  <input aria-label={`${line.customerNumber} 부과액`} readOnly value={line.charge.toLocaleString("ko-KR")} className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-2 text-right text-[11.5px] font-semibold tabular-nums text-t2 outline-none" />
                ) : display(line.charge)}
              </td>
              <td className="px-4 text-right text-t3">-</td>
              <td className="px-4 text-right tabular-nums">{display(line.unitPrice)}</td>
              <td className="px-4 text-right text-t3">-</td>
              <td className="px-4 text-right text-t3">-</td>
              <td className="px-4 text-right tabular-nums">{display(line.currentReading)}</td>
              <td className="px-4 text-right tabular-nums">{display(line.previousReading)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lines.length === 0 && (
        <p className="flex h-[51px] w-[1294px] items-center justify-center text-[13px] text-t3">등록된 고객번호가 없어요.</p>
      )}
    </section>
  );
}
