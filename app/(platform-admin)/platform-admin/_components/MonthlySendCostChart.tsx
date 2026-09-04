"use client";

import { useMemo, useState } from "react";
import { EmptyState, Spinner } from "@/components/common";
import { ChevronDownIcon } from "@/components/icons";
import {
  type PlatformMonthlySendCost,
  usePlatformMonthlySendCost,
} from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";
import { QueryError } from "../../_components/PageElements";

const CHANNELS = [
  { label: "알림톡", color: "bg-blue" },
  { label: "문자", color: "bg-[#7CC7BF]" },
  { label: "팩스", color: "bg-[#C6D3DC]" },
] as const;

function totalCost(cost: PlatformMonthlySendCost): number {
  return cost.alimtalkKrw + cost.smsKrw + cost.faxKrw;
}

export function MonthlySendCostChart() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const monthlyCostQuery = usePlatformMonthlySendCost(year);
  const yearOptions = [currentYear, currentYear - 1];

  return (
    <section
      aria-label="월별 발송 비용"
      className="bg-surface rounded-2xl shadow-card overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-[18px] py-[15px] border-b border-line2">
        <h3 className="text-[15px] font-extrabold text-t1">
          알림톡 · 문자 · 팩스 발송 비용
        </h3>
        <label className="relative ml-auto">
          <span className="sr-only">발송 비용 연도</span>
          <select
            aria-label="발송 비용 연도"
            className="h-[36px] cursor-pointer appearance-none rounded-[11px] border border-line bg-surface pl-[12px] pr-[34px] text-[13.5px] font-bold text-t1 outline-none transition-colors hover:bg-bg"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {yearOptions.map((option) => (
              <option key={option} value={option}>{option}년</option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-[12px] top-1/2 size-[14px] -translate-y-1/2 stroke-[2.2] text-t3" />
        </label>
      </div>

      {monthlyCostQuery.isPending ? (
        <div className="py-16"><Spinner /></div>
      ) : monthlyCostQuery.isError ? (
        <div className="p-4">
          <QueryError onRetry={() => void monthlyCostQuery.refetch()} />
        </div>
      ) : monthlyCostQuery.data ? (
        <MonthlySendCostBars year={year} costs={monthlyCostQuery.data} />
      ) : (
        <EmptyState message="발송 비용 데이터가 없습니다" />
      )}
    </section>
  );
}

function MonthlySendCostBars({
  year,
  costs,
}: {
  year: number;
  costs: PlatformMonthlySendCost[];
}) {
  const summary = useMemo(() => {
    const totals = costs.map(totalCost);
    const dataMonths = totals.filter((total) => total > 0).length;
    const annualTotal = totals.reduce((sum, total) => sum + total, 0);

    return {
      totals,
      dataMonths,
      annualTotal,
      average: dataMonths > 0 ? Math.round(annualTotal / dataMonths) : 0,
      max: Math.max(...totals, 0),
      latestMonth: costs.reduce(
        (latest, cost) => totalCost(cost) > 0 ? Math.max(latest, cost.month) : latest,
        0,
      ),
    };
  }, [costs]);

  return (
    <>
      <div className="px-5 pt-[18px] pb-1.5">
        <div className="flex items-center gap-4 flex-wrap pb-4 border-b border-line2">
          {CHANNELS.map((channel) => (
            <div
              key={channel.label}
              className="flex items-center gap-[7px] text-[12.5px] font-bold text-t2"
            >
              <span className={`h-2.5 w-2.5 rounded-[3px] ${channel.color}`} />
              {channel.label}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-[9px] mt-4">
          {costs.map((cost, index) => {
            const total = summary.totals[index] ?? totalCost(cost);
            const isEmpty = total <= 0;
            const isLatest = cost.month === summary.latestMonth;
            const stackWidth = summary.max > 0 ? (total / summary.max) * 100 : 0;

            return (
              <div key={cost.month} className="flex items-center gap-3">
                <div
                  className={`w-11 flex-none text-[12.5px] font-bold ${isLatest ? "text-t1" : "text-t3"}`}
                >
                  {cost.month}월
                </div>
                <div className="flex-1 min-w-0 flex">
                  {isEmpty ? (
                    <div className="flex h-[26px] w-[18%] overflow-hidden rounded-lg bg-[repeating-linear-gradient(45deg,#F4F6F8_0_6px,#EDF0F3_6px_12px)] transition-[width] duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)]" />
                  ) : (
                    <div
                      aria-label={`${cost.month}월 발송 비용 ${formatNumber(total)}원`}
                      className="flex h-[26px] overflow-hidden rounded-lg bg-line2 transition-[width] duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
                      role="img"
                      style={{ width: `${stackWidth}%` }}
                    >
                      <i
                        className="h-full bg-blue"
                        style={{ width: `${(cost.alimtalkKrw / total) * 100}%` }}
                      />
                      <i
                        className="h-full bg-[#7CC7BF]"
                        style={{ width: `${(cost.smsKrw / total) * 100}%` }}
                      />
                      <i
                        className="h-full bg-[#C6D3DC]"
                        style={{ width: `${(cost.faxKrw / total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                <div
                  className={`w-[88px] flex-none text-right text-[12.5px] font-extrabold num ${
                    isLatest ? "text-t1" : "text-t2"
                  }`}
                >
                  {isEmpty ? "-" : `${formatNumber(total)}원`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-[9px] border-t border-line2 px-5 pb-[18px] pt-3.5">
        <div className="text-[13px] font-bold text-t2">{year}년 누계</div>
        <div className="text-[12px] font-semibold text-t3 num">
          {summary.dataMonths}개월 · 월 평균 {formatNumber(summary.average)}원
        </div>
        <div className="ml-auto text-[18px] font-extrabold tracking-[-0.02em] num">
          {formatNumber(summary.annualTotal)}원
        </div>
      </div>
    </>
  );
}
