"use client";

import { Fragment, useMemo, useState } from "react";
import { Button, Spinner } from "@/components/common";
import { useGiroPayments } from "@/hooks/reactquery/payments";
import { formatNumber } from "@/lib/format";
import { ComplaintDialog } from "../ComplaintDialog";

interface GiroCalendarModalProps {
  open: boolean;
  buildingId: number;
  period: string;
  onClose: () => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 지로처리일자 확인 — 처리일자별 지로 수납 건수·금액(Figma).
 * 지로 수납 데이터만 실집계(지로결재·합계). 금융결재는 지로 정산액과 동일 표기,
 * 차액·일반수납·이체수납은 별도 소스가 없어 0으로 둔다(프론트 재현).
 */
const METRICS = [
  { key: "finance", label: "금융결재" },
  { key: "giro", label: "지로결재" },
  { key: "diff", label: "차액" },
  { key: "general", label: "일반수납" },
  { key: "transfer", label: "이체수납" },
  { key: "total", label: "합계" },
] as const;

function niceCeil(value: number) {
  if (value <= 0) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function manLabel(value: number) {
  if (value === 0) return "0";
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만`;
}

export function GiroCalendarModal({ open, buildingId, period, onClose }: GiroCalendarModalProps) {
  const { data: giro = [], isLoading } = useGiroPayments(buildingId, period);
  const [cursor, setCursor] = useState(() => {
    const [y, m] = period.slice(0, 7).split("-").map(Number);
    return { year: y || new Date().getFullYear(), month: m || 1 };
  });

  const dayTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const row of giro) {
      if (row.status !== "active") continue;
      const [gy, gm, gd] = (row.paidAt?.slice(0, 10) ?? "").split("-").map(Number);
      if (gy !== cursor.year || gm !== cursor.month || !gd) continue;
      totals[gd] = (totals[gd] ?? 0) + row.amount;
    }
    return totals;
  }, [giro, cursor]);

  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
  const firstWeekday = new Date(cursor.year, cursor.month - 1, 1).getDay();

  const weeks = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const chunked: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) chunked.push(cells.slice(i, i + 7));
    return chunked;
  }, [firstWeekday, daysInMonth]);

  const metricValue = (metricKey: (typeof METRICS)[number]["key"], day: number) => {
    const total = dayTotals[day] ?? 0;
    if (metricKey === "finance" || metricKey === "giro" || metricKey === "total") return total;
    return 0;
  };

  const chartRows = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, index) => ({
        day: index + 1,
        value: dayTotals[index + 1] ?? 0,
      })),
    [daysInMonth, dayTotals],
  );
  const chartMax = niceCeil(Math.max(0, ...chartRows.map((row) => row.value)));
  const ticks = chartMax > 0 ? [0, 0.25, 0.5, 0.75, 1].map((r) => chartMax * r) : [0];

  const moveMonth = (delta: number) => {
    setCursor((current) => {
      const next = current.month + delta;
      if (next < 1) return { year: current.year - 1, month: 12 };
      if (next > 12) return { year: current.year + 1, month: 1 };
      return { year: current.year, month: next };
    });
  };

  return (
    <ComplaintDialog
      open={open}
      onClose={onClose}
      title="지로처리일자 확인"
      subtitle="처리일자별 지로 수납 건수와 금액이에요"
      size="wide"
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="이전 달"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-t3 hover:bg-bg"
          onClick={() => moveMonth(-1)}
        >
          ‹
        </button>
        <span className="text-base font-extrabold text-t1">
          {cursor.year}년 {cursor.month}월
        </span>
        <button
          type="button"
          aria-label="다음 달"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-t3 hover:bg-bg"
          onClick={() => moveMonth(1)}
        >
          ›
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 캘린더 */}
        <div className="rounded-xl border border-line">
            {isLoading ? (
              <div className="py-10">
                <Spinner />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-line bg-bg text-center text-[11px] font-bold text-t3">
                  <div className="py-2" />
                  {WEEKDAYS.map((weekday, index) => (
                    <div
                      key={weekday}
                      className={`py-2 ${index === 0 ? "text-red" : index === 6 ? "text-blue" : ""}`}
                    >
                      {weekday}
                    </div>
                  ))}
                </div>
                {weeks.map((week, weekIndex) => (
                  <div
                    key={weekIndex}
                    className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-line last:border-0 text-[10px]"
                  >
                    <div className="border-r border-line" />
                    {week.map((day, dayIndex) => (
                      <div
                        key={dayIndex}
                        className="border-r border-line py-1 text-center last:border-0"
                      >
                        {day ? (
                          <span
                            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-bold ${
                              dayTotals[day]
                                ? "bg-blue text-white"
                                : "text-t2"
                            }`}
                          >
                            {day}
                          </span>
                        ) : null}
                      </div>
                    ))}
                    {METRICS.map((metric) => (
                      <Fragment key={metric.key}>
                        <div className="border-r border-t border-line px-1 py-0.5 text-t3">
                          {metric.label}
                        </div>
                        {week.map((day, dayIndex) => {
                          const value = day ? metricValue(metric.key, day) : 0;
                          return (
                            <div
                              key={dayIndex}
                              className={`num border-r border-t border-line px-1 py-0.5 text-right last:border-r-0 ${
                                metric.key === "total" ? "font-bold text-t1" : "text-t2"
                              }`}
                            >
                              {day && value ? formatNumber(value) : ""}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* 그래프 */}
          <div className="rounded-xl border border-line p-3">
            <p className="text-sm font-extrabold text-t1">수납일자별 그래프</p>
            <div className="mt-2 flex justify-between text-[9px] text-t4">
              {ticks.map((tick, index) => (
                <span key={index}>{manLabel(tick)}</span>
              ))}
            </div>
            <div className="mt-1 space-y-1">
              {chartRows.map((row) => (
                <div key={row.day} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-4 shrink-0 text-right text-t3">{row.day}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: chartMax > 0 ? `${(row.value / chartMax) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="num w-16 shrink-0 text-right text-t2">
                    {row.value ? formatNumber(row.value) : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
    </ComplaintDialog>
  );
}
