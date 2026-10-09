"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { DpTimePicker } from "@/components/common/DpTimePicker";
import { Input, Radio } from "@/components/common";
import { CalendarIcon, CheckIcon, ClockIcon } from "@/components/icons";
import type { RecurrenceMode } from "@/hooks/reactquery/messaging/apis";

export interface ScheduleValue {
  scheduledAt: string | null;
  recurrenceMode: RecurrenceMode | null;
  /** 반복 종료 횟수(이 예약 포함 총 발송 횟수). null = 계속 반복. */
  recurrenceEndCount: number | null;
}

/** 정본 repScrim 「횟수 지정」 기본값. */
export const DEFAULT_RECURRENCE_END_COUNT = 12;
export const MAX_RECURRENCE_END_COUNT = 999;

const RECURRENCE_LABEL: Record<RecurrenceMode, string> = { monthly: "매월", weekly: "매주" };

/** 반복 표기: "매월 반복" / "매주 반복 · 12회". */
export function formatRecurrence(mode: RecurrenceMode, endCount: number | null): string {
  return `${RECURRENCE_LABEL[mode]} 반복${endCount ? ` · ${endCount}회` : ""}`;
}

/** 횟수 입력값 정규화: 숫자만, 1~999. */
export function parseRecurrenceEndCount(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  const value = digits ? Number(digits) : 1;
  return Math.min(MAX_RECURRENCE_END_COUNT, Math.max(1, value));
}

interface SchedulePickerProps {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
}

const CONTROL_CLASS_NAME =
  "flex h-[44px] flex-1 min-w-0 items-center gap-[8px] rounded-[11px] border border-line bg-white px-[13px] text-[13.5px] font-bold text-t1 focus-within:border-blue";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function defaultKstParts(): { date: string; time: string } {
  const next = new Date(Date.now() + 10 * 60_000);
  const rounded = new Date(Math.ceil(next.getTime() / (5 * 60_000)) * 5 * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(rounded);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour}:${value.minute}`,
  };
}

function scheduledParts(value: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const direct = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?\+09:00$/,
  );
  if (direct) return { date: direct[1], time: direct[2] };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${mapped.year}-${mapped.month}-${mapped.day}`,
    time: `${mapped.hour}:${mapped.minute}`,
  };
}

function toKstIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  return `${date}T${time}:00+09:00`;
}

type RepeatMenuPosition = { left: number; top: number };

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const [minimumDate] = useState(() => defaultKstParts().date);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatMenuPosition, setRepeatMenuPosition] = useState<RepeatMenuPosition | null>(null);
  const repeatTriggerRef = useRef<HTMLButtonElement>(null);
  const repeatMenuRef = useRef<HTMLDivElement>(null);
  const endGroupName = useId();
  const enabled = value.scheduledAt !== null;
  const parts = scheduledParts(value.scheduledAt);

  useEffect(() => {
    if (!repeatOpen) return;
    const placeMenu = () => {
      const rect = repeatTriggerRef.current?.getBoundingClientRect();
      if (rect) setRepeatMenuPosition({ left: rect.left, top: rect.bottom + 6 });
    };
    placeMenu();
    window.addEventListener("scroll", placeMenu, true);
    window.addEventListener("resize", placeMenu);
    return () => {
      window.removeEventListener("scroll", placeMenu, true);
      window.removeEventListener("resize", placeMenu);
    };
  }, [repeatOpen]);

  useEffect(() => {
    if (!repeatOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!repeatTriggerRef.current?.contains(target) && !repeatMenuRef.current?.contains(target)) {
        setRepeatOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRepeatOpen(false);
        repeatTriggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [repeatOpen]);

  const toggle = () => {
    if (enabled) {
      setRepeatOpen(false);
      onChange({ scheduledAt: null, recurrenceMode: null, recurrenceEndCount: null });
      return;
    }
    const next = defaultKstParts();
    onChange({
      scheduledAt: toKstIso(next.date, next.time),
      recurrenceMode: null,
      recurrenceEndCount: null,
    });
  };

  const toggleRepeat = () => {
    if (repeatOpen) {
      setRepeatOpen(false);
      return;
    }
    const rect = repeatTriggerRef.current?.getBoundingClientRect();
    if (rect) setRepeatMenuPosition({ left: rect.left, top: rect.bottom + 6 });
    setRepeatOpen(true);
  };

  return (
    <>
      <div className="mb-[10px] flex min-h-[24px] flex-wrap items-center gap-[18px]">
        <button
          type="button"
          className="inline-flex min-h-[22px] cursor-pointer select-none items-center gap-[8px] text-[13px] font-bold leading-[1.4] text-t2"
          onClick={toggle}
          aria-pressed={enabled}
        >
          <span
            className={`relative size-[19px] shrink-0 rounded-[6px] border-2 ${
              enabled ? "border-blue bg-blue" : "border-line bg-white"
            }`}
            aria-hidden="true"
          >
            {enabled && (
              <span className="absolute left-[1.14px] top-[0.51px] flex size-[12.728px] items-center justify-center">
                <span className="h-[11px] w-[7px] rotate-45 border-b-2 border-r-2 border-white" />
              </span>
            )}
          </span>
          <span>예약 전송</span>
        </button>
      </div>

      {enabled && (
        <div className="mb-[16px] flex w-full items-start gap-[8px]">
          <DpDatePicker
            className="min-w-0 flex-1"
            triggerClassName={CONTROL_CLASS_NAME}
            triggerOpenClassName="border-blue"
            startAdornment={<CalendarIcon variant="messenger-date" className="size-[16px] shrink-0 text-t3" />}
            placeholder="날짜 선택"
            ariaLabel="예약 날짜"
            value={parts.date}
            onChange={(date) =>
              onChange({
                scheduledAt: toKstIso(date, parts.time),
                recurrenceMode: value.recurrenceMode,
                recurrenceEndCount: value.recurrenceEndCount,
              })
            }
            minDate={minimumDate}
          />

          <DpTimePicker
            className="min-w-0 flex-1"
            triggerClassName={CONTROL_CLASS_NAME}
            triggerOpenClassName="border-blue"
            startAdornment={<ClockIcon className="size-[16px] shrink-0 text-t3" />}
            placeholder="시간 선택"
            ariaLabel="예약 시간"
            value={parts.time}
            onChange={(time) =>
              onChange({
                scheduledAt: toKstIso(parts.date, time),
                recurrenceMode: value.recurrenceMode,
                recurrenceEndCount: value.recurrenceEndCount,
              })
            }
          />

          <button
            ref={repeatTriggerRef}
            type="button"
            className={`${CONTROL_CLASS_NAME} ${repeatOpen ? "border-blue" : ""}`}
            aria-haspopup="listbox"
            aria-expanded={repeatOpen}
            onClick={toggleRepeat}
          >
            <CalendarIcon variant="messenger-repeat" className="size-[16px] shrink-0 text-t3" />
            <span className={value.recurrenceMode ? "text-[13.5px] font-bold text-t1" : "text-[13.5px] font-semibold text-t4"}>
              {value.recurrenceMode ? RECURRENCE_LABEL[value.recurrenceMode] : "반복 없음"}
            </span>
          </button>

          {repeatOpen && repeatMenuPosition &&
            createPortal(
              <div
                ref={repeatMenuRef}
                role="listbox"
                aria-label="반복 주기"
                className="fixed z-[47] min-w-[132px] flex flex-col rounded-[14px] border border-line bg-white p-1.5 leading-[normal] shadow-[0_16px_40px_-12px_rgba(23,31,40,0.3)]"
                style={{ left: repeatMenuPosition.left, top: repeatMenuPosition.top }}
              >
                {([
                  [null, "반복 없음"],
                  ["monthly", "매월"],
                  ["weekly", "매주"],
                ] as const).map(([mode, label]) => {
                  const selected = value.recurrenceMode === mode;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`flex w-full items-center justify-between gap-2 rounded-[9px] px-[11px] py-[9px] text-[13px] font-bold text-t2 hover:bg-bg ${
                        selected ? "bg-blue-t2 text-blue-d" : ""
                      }`}
                      onClick={() => {
                        onChange({
                          scheduledAt: value.scheduledAt,
                          recurrenceMode: mode,
                          recurrenceEndCount: mode ? value.recurrenceEndCount : null,
                        });
                        setRepeatOpen(false);
                      }}
                    >
                      {label}
                      {selected && <CheckIcon className="size-[14px] shrink-0" />}
                    </button>
                  );
                })}
              </div>,
              document.body,
            )}
        </div>
      )}

      {/* 정책: 종료(계속 반복/횟수 지정) — 반복을 고른 경우에만 */}
      {enabled && value.recurrenceMode && (
        <div className="-mt-[6px] mb-[16px] flex min-h-[36px] flex-wrap items-center gap-[18px]">
          <span className="text-[13px] font-bold text-t2">종료</span>
          <Radio
            name={endGroupName}
            label="계속 반복"
            checked={value.recurrenceEndCount === null}
            onChange={() => onChange({ ...value, recurrenceEndCount: null })}
          />
          <Radio
            name={endGroupName}
            label="횟수 지정"
            checked={value.recurrenceEndCount !== null}
            onChange={() => onChange({ ...value, recurrenceEndCount: value.recurrenceEndCount ?? DEFAULT_RECURRENCE_END_COUNT })}
          />
          {value.recurrenceEndCount !== null && (
            <span className="inline-flex items-center gap-[8px]">
              <Input
                unstyled
                inputMode="numeric"
                aria-label="반복 횟수"
                value={String(value.recurrenceEndCount)}
                onChange={(event) => onChange({ ...value, recurrenceEndCount: parseRecurrenceEndCount(event.target.value) })}
                className="h-[36px] w-[72px] rounded-[11px] border border-line bg-white px-[12px] text-right text-[13.5px] font-bold text-t1 outline-none focus:border-blue"
              />
              <span className="text-[13px] font-semibold text-t2">회 후 종료</span>
            </span>
          )}
        </div>
      )}
    </>
  );
}

export function formatScheduledAt(value: string | null): string {
  if (!value) return "즉시 발송";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(parsed);
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${mapped.year}.${pad(Number(mapped.month))}.${pad(Number(mapped.day))} (${mapped.weekday}) ${mapped.dayPeriod} ${mapped.hour}:${mapped.minute}`;
}
