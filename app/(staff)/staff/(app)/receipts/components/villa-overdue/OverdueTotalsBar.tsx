import { formatNumber } from "@/lib/format";
import type { OverdueRollup } from "./buildOverdueGroups";

interface OverdueTotalsBarProps {
  totals: OverdueRollup & { lineCount: number; unitCount: number };
}

const money = (value: number) => formatNumber(value, { nullText: "0" });

/** 정본 `.up-sum` 규격의 하단 총계 스트립 (Figma 673:22061). */
export function OverdueTotalsBar({ totals }: OverdueTotalsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-[7px] text-[14px] font-medium leading-[normal] tabular-nums text-t1">
      <b className="font-medium">항목</b> {totals.lineCount} / <b className="font-medium">동호</b>{" "}
      {totals.unitCount}건
      <i className="ml-[12px] mr-[2px] text-[12.5px] font-medium not-italic text-t3">미납액</i>
      {money(totals.unpaid)}
      <i className="ml-[12px] mr-[2px] text-[12.5px] font-medium not-italic text-t3">납.연체료</i>
      {money(totals.lateFee)}
      <i className="ml-[12px] mr-[2px] text-[12.5px] font-medium not-italic text-t3">납.후연체</i>
      {money(totals.postLate)}
      <i className="ml-[12px] mr-[2px] text-[12.5px] font-medium not-italic text-t3">연체료계</i>
      {money(totals.lateTotal)}
      <i className="ml-[12px] mr-[2px] text-[12.5px] font-medium not-italic text-t3">합계</i>
      <b className="text-[15px] font-extrabold text-t1">{money(totals.total)}</b>
    </div>
  );
}
