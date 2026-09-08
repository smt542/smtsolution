import { formatNumber } from "@/lib/format";
import { A4LandscapeDocumentShell } from "../A4LandscapeDocumentShell";
import type { OverdueDisplayGroup, OverdueRollup } from "./buildOverdueGroups";
import { formatPeriodSlash } from "./format";

interface VillaOverduePrintViewProps {
  groups: OverdueDisplayGroup[];
  totals: OverdueRollup & { lineCount: number; unitCount: number };
  buildingName: string;
  billerName: string;
  asOfLabel: string; // '2026/08 까지'
  scopeLabel: string; // '전체' | '당월'
}

const num = "border border-black px-1.5 py-1 text-right tabular-nums";
const text = "border border-black px-1.5 py-1 text-left";
const money = (value: number) => formatNumber(value, { nullText: "0" });

export function VillaOverduePrintView({
  groups,
  totals,
  buildingName,
  billerName,
  asOfLabel,
  scopeLabel,
}: VillaOverduePrintViewProps) {
  return (
    <A4LandscapeDocumentShell
      testId="villa-overdue-print-view"
      buildingName={buildingName}
      title={
        <>
          <p className="text-[10px] font-bold tracking-[0.2em]">OVERDUE STATEMENT</p>
          <h1 className="mt-1 text-xl font-black">[ {buildingName} 미납내역 ]</h1>
          <p className="mt-1 text-xs font-bold">
            {asOfLabel} · {scopeLabel} · 항목 {totals.lineCount} / 동호 {totals.unitCount}건
          </p>
        </>
      }
    >
      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr className="bg-slate-100">
            <th className={text}>동호</th>
            <th className={text}>거래처명</th>
            <th className={text}>년월</th>
            <th className={num}>연체</th>
            <th className={num}>미납액</th>
            <th className={num}>납.연체료</th>
            <th className={num}>납.후연체</th>
            <th className={num}>연체료계</th>
            <th className={num}>합계</th>
            <th className={text}>비고</th>
            <th className={text}>전화</th>
            <th className={text}>이름</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <PrintGroup key={group.occupancyId} group={group} billerName={billerName} />
          ))}
          <tr className="bg-slate-100 font-bold">
            <td className={text} colSpan={4}>
              총 계
            </td>
            <td className={num}>{money(totals.unpaid)}</td>
            <td className={num}>{money(totals.lateFee)}</td>
            <td className={num}>{money(totals.postLate)}</td>
            <td className={num}>{money(totals.lateTotal)}</td>
            <td className={num}>{money(totals.total)}</td>
            <td className={text} colSpan={3} />
          </tr>
        </tbody>
      </table>
    </A4LandscapeDocumentShell>
  );
}

function PrintGroup({
  group,
  billerName,
}: {
  group: OverdueDisplayGroup;
  billerName: string;
}) {
  return (
    <>
      {group.lines.map((line, index) => (
        <tr key={line.key}>
          <td className={text}>{index === 0 ? group.unitLabel : ""}</td>
          <td className={text}>{index === 0 ? billerName : ""}</td>
          <td className={text}>{formatPeriodSlash(line.period)}</td>
          <td className={num}>{line.overdueMonths}</td>
          <td className={num}>{money(line.unpaid)}</td>
          <td className={num}>{money(line.displayLateFee)}</td>
          <td className={num}>{money(line.postLate)}</td>
          <td className={num}>{money(line.lateTotal)}</td>
          <td className={num}>{money(line.total)}</td>
          <td className={text}>{line.note}</td>
          <td className={text}>{index === 0 ? group.phone ?? "" : ""}</td>
          <td className={text}>{index === 0 ? group.tenantName ?? "" : ""}</td>
        </tr>
      ))}
      <tr className="bg-slate-50 font-bold">
        <td className={text} colSpan={4}>
          [호합]
        </td>
        <td className={num}>{money(group.rollup.unpaid)}</td>
        <td className={num}>{money(group.rollup.lateFee)}</td>
        <td className={num}>{money(group.rollup.postLate)}</td>
        <td className={num}>{money(group.rollup.lateTotal)}</td>
        <td className={num}>{money(group.rollup.total)}</td>
        <td className={text} colSpan={3} />
      </tr>
    </>
  );
}
