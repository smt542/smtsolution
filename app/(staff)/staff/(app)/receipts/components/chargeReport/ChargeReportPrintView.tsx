import { formatNumber } from "@/lib/format";
import { A4LandscapeDocumentShell } from "../A4LandscapeDocumentShell";
import type { ChargeReportModel } from "./buildChargeReport";

interface ChargeReportPrintViewProps {
  model: ChargeReportModel;
  buildingName: string;
  rangeLabel: string;
}

const cell = "border border-black px-1.5 py-1 text-right tabular-nums";
const num = (value: number) =>
  value < 0 ? <span className="text-red">{formatNumber(value)}</span> : formatNumber(value);

export function ChargeReportPrintView({ model, buildingName, rangeLabel }: ChargeReportPrintViewProps) {
  const { months, feeItems, totals } = model;

  return (
    <A4LandscapeDocumentShell
      testId="charge-report-print-view"
      buildingName={buildingName}
      title={
        <>
          <p className="text-[10px] font-bold tracking-[0.2em]">CHARGE / RECEIPT REPORT</p>
          <h1 className="mt-1 text-xl font-black">[ {buildingName} 부과금액 및 수납자료 ]</h1>
          <p className="mt-1 text-xs font-bold">기준월 · {rangeLabel}</p>
        </>
      }
    >
      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-black px-1.5 py-1">년월</th>
            <th className="border border-black px-1.5 py-1 text-right">당월분</th>
            <th className="border border-black px-1.5 py-1 text-right">수납율</th>
            <th className="border border-black px-1.5 py-1 text-right">수수료</th>
            <th className="border border-black px-1.5 py-1 text-right">당월수납액</th>
            <th className="border border-black px-1.5 py-1 text-right">연체료</th>
            <th className="border border-black px-1.5 py-1 text-right">실수납액</th>
            {feeItems.map((item) => (
              <th key={item.feeItemId} className="border border-black px-1.5 py-1 text-right">
                {item.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.period}>
              <td className="border border-black px-1.5 py-1 text-center">{month.periodLabel}</td>
              <td className={cell}>{num(month.charged)}</td>
              <td className={`${cell} text-red`}>
                {month.rate === null ? "-" : `${month.rate.toFixed(1)}%`}
              </td>
              <td className={cell}>{num(month.fee)}</td>
              <td className={cell}>{num(month.paid)}</td>
              <td className={cell}>{num(month.lateFee)}</td>
              <td className={cell}>{num(month.netPaid)}</td>
              {feeItems.map((item) => (
                <td key={item.feeItemId} className={cell}>
                  {num(month.feeItemAmounts[item.feeItemId] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-slate-100 font-bold">
            <td className="border border-black px-1.5 py-1 text-center">총계</td>
            <td className={cell}>{num(totals.charged)}</td>
            <td className={`${cell} text-red`}>
              {totals.rate === null ? "-" : `${totals.rate.toFixed(1)}%`}
            </td>
            <td className={cell}>{num(totals.fee)}</td>
            <td className={cell}>{num(totals.paid)}</td>
            <td className={cell}>{num(totals.lateFee)}</td>
            <td className={cell}>{num(totals.netPaid)}</td>
            {feeItems.map((item) => (
              <td key={item.feeItemId} className={cell}>
                {num(totals.feeItemAmounts[item.feeItemId] ?? 0)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </A4LandscapeDocumentShell>
  );
}
