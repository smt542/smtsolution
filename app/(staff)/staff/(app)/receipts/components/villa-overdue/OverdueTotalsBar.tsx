import { formatNumber } from "@/lib/format";
import type { OverdueRollup } from "./buildOverdueGroups";

interface OverdueTotalsBarProps {
  totals: OverdueRollup & { lineCount: number; unitCount: number };
}

const money = (value: number) => formatNumber(value, { nullText: "0" });

function Metric({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-[6px]">
      <span className="text-[12px] text-t3">{label}</span>
      <span
        className={`text-[13px] tabular-nums ${strong ? "font-bold text-t1" : "font-medium text-t2"}`}
      >
        {money(value)}
      </span>
    </span>
  );
}

/** 하단 총계 스트립 (Figma 673:22061). */
export function OverdueTotalsBar({ totals }: OverdueTotalsBarProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-[18px] gap-y-[4px]">
      <span className="flex items-baseline gap-[6px]">
        <span className="text-[13px] font-bold text-t1">항목</span>
        <span className="text-[13px] tabular-nums text-t2">{totals.lineCount} /</span>
        <span className="text-[13px] font-bold text-t1">동호</span>
        <span className="text-[13px] tabular-nums text-t2">{totals.unitCount}건</span>
      </span>
      <Metric label="미납액" value={totals.unpaid} />
      <Metric label="납.연체료" value={totals.lateFee} />
      <Metric label="납.후연체" value={totals.postLate} />
      <Metric label="연체료계" value={totals.lateTotal} />
      <Metric label="합계" value={totals.total} strong />
    </div>
  );
}
