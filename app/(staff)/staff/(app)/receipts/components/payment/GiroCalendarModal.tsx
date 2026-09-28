"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/common";
import { usePaymentsByPaidDate } from "@/hooks/reactquery/payments";
import { formatNumber } from "@/lib/format";
import { ComplaintDialog } from "../ComplaintDialog";

interface GiroCalendarModalProps {
  open: boolean;
  buildingId: number | null;
  period: string;
  onClose: () => void;
}

interface CalendarCursor {
  year: number;
  month: number;
}

interface DayValues {
  finance: number;
  giro: number;
  diff: number;
  general: number;
  transfer: number;
  total: number;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const METRICS = [
  { key: "finance", label: "금융결재" },
  { key: "giro", label: "지로결재" },
  { key: "diff", label: "차액" },
  { key: "general", label: "일반수납" },
  { key: "transfer", label: "이체수납" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

const EMPTY_DAY: DayValues = {
  finance: 0,
  giro: 0,
  diff: 0,
  general: 0,
  transfer: 0,
  total: 0,
};

// 정본 `.gw-r`/`.gw-lb`/`.gw-c`. 칸은 전부 가운데 정렬이고(값 칸도 `.gw-c` 상속), 글자 크기는
// 요일 머리 칸만 11.5px라 크기 클래스를 칸 종류마다 하나씩만 준다.
const CALENDAR_ROW = "grid grid-cols-[56px_repeat(7,minmax(56px,1fr))] items-center";
const CALENDAR_LABEL =
  "text-right whitespace-nowrap pr-[7px] text-[10px] leading-[normal]";
const CALENDAR_CELL_BASE =
  "overflow-hidden text-ellipsis whitespace-nowrap text-center leading-[normal]";
const CALENDAR_CELL = `${CALENDAR_CELL_BASE} text-[10px]`;
const CALENDAR_WEEKDAY = `${CALENDAR_CELL_BASE} px-[3px] py-[3px] bg-white text-[11.5px] font-bold`;
const CALENDAR_VALUE = `${CALENDAR_CELL} px-[3px] py-[3px] font-normal num`;

function cursorFromPeriod(period: string): CalendarCursor {
  const [year, month] = period.slice(0, 7).split("-").map(Number);
  if (year && month >= 1 && month <= 12) return { year, month };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatAxisTick(value: number) {
  if (value >= 100_000_000) return `${Math.round(value / 10_000_000) / 10}억`;
  if (value >= 10_000) return `${Math.round(value / 1_000) / 10}만`;
  return String(value);
}

export function GiroCalendarModal({ open, period, onClose }: GiroCalendarModalProps) {
  const [cursor, setCursor] = useState<CalendarCursor>(() => cursorFromPeriod(period));
  const { data: payments, isError, isPending } = usePaymentsByPaidDate(
    cursor.year,
    cursor.month,
  );

  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
  const firstWeekday = new Date(cursor.year, cursor.month - 1, 1).getDay();
  // 캐시된 달로 돌아갈 때는 값을 그대로 보여 준다(백그라운드 재조회로 비우지 않음).
  const loading = isPending || isError;

  const dayValues = useMemo(() => {
    const totals: Record<number, DayValues> = {};
    if (loading) return totals;

    for (const payment of payments ?? []) {
      const day = Number(payment.paidAt.slice(8, 10));
      if (!day || day < 1 || day > daysInMonth) continue;
      const current = totals[day] ?? { ...EMPTY_DAY };
      if (payment.method === "giro") current.giro += payment.amount;
      if (["cash", "transfer", "card", "other"].includes(payment.method)) {
        current.general += payment.amount;
      }
      if (payment.method === "auto_debit") current.transfer += payment.amount;
      current.finance = current.giro;
      current.diff = current.finance - current.giro;
      current.total = current.finance + current.general + current.transfer;
      totals[day] = current;
    }
    return totals;
  }, [daysInMonth, loading, payments]);

  const weeks = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let index = 0; index < firstWeekday; index += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, index) =>
      cells.slice(index * 7, index * 7 + 7),
    );
  }, [daysInMonth, firstWeekday]);

  const chartRows = useMemo(
    () =>
      Array.from({ length: 31 }, (_, index) => {
        const day = index + 1;
        return { day, value: day <= daysInMonth ? (dayValues[day]?.total ?? 0) : 0 };
      }),
    [dayValues, daysInMonth],
  );
  const chartTotal = chartRows.reduce((sum, row) => sum + row.value, 0);
  const chartMaxValue = Math.max(1, ...chartRows.map((row) => row.value));
  const step = Math.pow(10, Math.floor(Math.log10(chartMaxValue)));
  const chartTop = Math.ceil(chartMaxValue / step) * step;
  const ticks = chartTotal === 0
    ? [0]
    : [0, chartTop * 0.25, chartTop * 0.5, chartTop * 0.75, chartTop];

  const moveMonth = (delta: number) => {
    setCursor((current) => {
      const nextMonth = current.month + delta;
      if (nextMonth < 1) return { year: current.year - 1, month: 12 };
      if (nextMonth > 12) return { year: current.year + 1, month: 1 };
      return { year: current.year, month: nextMonth };
    });
  };

  const valueFor = (day: number | null, key: MetricKey) => {
    if (!day) return 0;
    const values = dayValues[day] ?? EMPTY_DAY;
    return values[key];
  };

  return (
    <ComplaintDialog
      open={open}
      onClose={onClose}
      title="지로처리일자 확인"
      subtitle="처리일자별 지로 수납 건수와 금액이에요"
      size="wide"
      look="canon-wide"
      footer={
        <>
          <div className="flex-1" />
          <Button type="button" size="modal" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </>
      }
    >
      <div className="mb-[12px] flex h-[26px] shrink-0 items-center gap-[8px]">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="이전 달"
          onClick={() => moveMonth(-1)}
        >
          ‹
        </Button>
        <span className="min-w-[104px] text-center text-[14px] font-extrabold leading-[normal] text-t1">
          {cursor.year}년 {cursor.month}월
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="다음 달"
          onClick={() => moveMonth(1)}
        >
          ›
        </Button>
        <div className="flex-1" />
        {isError && (
          <span role="alert" className="text-[12px] font-medium leading-[normal] text-red">
            수납 내역을 불러오지 못했어요
          </span>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(240px,300px)] gap-[14px]">
        <div className="min-h-0 overflow-auto rounded-[14px] border border-[#DCE3EB] bg-white px-[10px] pb-[10px] tabular-nums">
          <div className={`${CALENDAR_ROW} sticky top-0 z-[5] bg-white pt-[8px] pb-[6px] shadow-[0_1px_0_#DCE3EB]`}>
            <div className={`${CALENDAR_LABEL} bg-white text-t1`} />
            {WEEKDAYS.map((weekday, index) => (
              <div
                key={weekday}
                className={`${CALENDAR_WEEKDAY} ${
                  index === 0 ? "text-red" : index === 6 ? "text-[#3182F6]" : "text-t3"
                }`}
              >
                {weekday}
              </div>
            ))}
          </div>

          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              // 정본 `.gw-wd+.gw`(첫 주)와 `.gw`(나머지 주). 겹치는 클래스 없이 한쪽만 준다.
              className={
                weekIndex === 0 ? "pt-[8px]" : "mt-[16px] border-t border-[#DCE3EB] pt-[14px]"
              }
            >
              <div className={`${CALENDAR_ROW} h-[37px]`}>
                <div className={`${CALENDAR_LABEL} text-t1`} />
                {week.map((day, dayIndex) => {
                  const dayTone = dayIndex === 0
                    ? "text-red"
                    : dayIndex === 6
                      ? "text-[#3182F6]"
                      : "text-t2";
                  const isOn = day ? (dayValues[day]?.finance ?? 0) > 0 : false;
                  return (
                    <div
                      key={dayIndex}
                      className={`${CALENDAR_CELL} pb-[12px] pt-[2px] ${dayTone}`}
                    >
                      {day ? (
                        <span
                          className={`inline-flex size-[23px] min-w-[23px] items-center justify-center rounded-full text-[12px] font-bold ${
                            isOn ? "bg-blue !text-white" : ""
                          }`}
                        >
                          {day}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {METRICS.map((metric) => {
                const isDiff = metric.key === "diff";
                return (
                  <div key={metric.key} className={CALENDAR_ROW}>
                    <div className={`${CALENDAR_LABEL} font-normal ${isDiff ? "text-red" : "text-t1"}`}>
                      {metric.label}
                    </div>
                    {week.map((day, dayIndex) => {
                      const value = valueFor(day, metric.key);
                      return (
                        <div
                          key={dayIndex}
                          className={`${CALENDAR_VALUE} ${isDiff ? "text-red" : "text-t1"}`}
                        >
                          {value ? formatNumber(value) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div className={`${CALENDAR_ROW} mt-[2px]`}>
                <div className={`${CALENDAR_LABEL} py-[5px] text-t2 font-bold`}>합계</div>
                {week.map((day, dayIndex) => {
                  const value = day ? (dayValues[day]?.total ?? 0) : 0;
                  return (
                    <div
                      key={dayIndex}
                      className={`${CALENDAR_CELL} px-[3px] py-[5px] text-t1 font-bold num`}
                    >
                      {value ? formatNumber(value) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-col rounded-[12px] border border-[#DCE3EB] bg-white p-[12px]">
          <div className="mb-[10px] text-center text-[12.5px] font-extrabold leading-[normal] text-t2">
            수납일자별 그래프
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-auto tabular-nums">
            <div className="mb-[7px] grid flex-none grid-cols-5 pl-[25px] pr-[73px] text-[10px] font-semibold leading-[normal] text-t4">
              {ticks.map((tick, index) => (
                <span key={index} className={index === 0 ? "" : "text-right"}>
                  {formatAxisTick(tick)}
                </span>
              ))}
            </div>
            {chartRows.map((row) => {
              const hasValue = row.value > 0;
              return (
                <div
                  key={row.day}
                  className="flex min-h-[14px] flex-1 items-center gap-[7px]"
                  title={`${cursor.month}/${row.day}${hasValue ? ` · ${formatNumber(row.value)}원` : " · 내역 없음"}`}
                >
                  <span className={`w-[18px] flex-none text-right text-[10.5px] font-semibold leading-[normal] ${hasValue ? "text-t3" : "text-t4"}`}>
                    {row.day}
                  </span>
                  <div className="h-[60%] max-h-[14px] min-h-[7px] min-w-0 flex-1 overflow-hidden rounded-[4px] bg-bg">
                    <div
                      className="h-full rounded-[3px] bg-blue"
                      style={{
                        width: hasValue
                          ? `${Math.max(1, Math.round((row.value / chartTop) * 100))}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <span className="w-[66px] flex-none text-right text-[10px] font-semibold leading-[normal] text-t2">
                    {hasValue ? formatNumber(row.value) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ComplaintDialog>
  );
}
