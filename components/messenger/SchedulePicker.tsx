"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { DpTimePicker } from "@/components/common/DpTimePicker";
import { CalendarIcon, CheckIcon, ClockIcon } from "@/components/icons";

export interface ScheduleValue {
  scheduledAt: string | null;
  recurrenceMode: "monthly" | null;
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
      onChange({ scheduledAt: null, recurrenceMode: null });
      return;
    }
    const next = defaultKstParts();
    onChange({
      scheduledAt: toKstIso(next.date, next.time),
      recurrenceMode: null,
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
    <div className="flex flex-col items-start">
      <div className="flex h-[24px] min-h-[24px] items-center">
        <button
          type="button"
          className="inline-flex min-h-[22px] cursor-pointer select-none items-center gap-[8px]"
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
          <span className="text-[13px] font-bold leading-[18.2px] text-t2">예약 전송</span>
        </button>
      </div>

      {enabled && (
        <div className="flex w-full items-start gap-[8px] pb-[16px] pt-[10px]">
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
            <span className={value.recurrenceMode === "monthly" ? "text-[13.5px] font-bold text-t1" : "text-[13.5px] font-semibold text-t4"}>
              {value.recurrenceMode === "monthly" ? "매월" : "반복 없음"}
            </span>
          </button>

          {repeatOpen && repeatMenuPosition &&
            createPortal(
              <div
                ref={repeatMenuRef}
                role="listbox"
                aria-label="반복 주기"
                className="fixed z-[47] min-w-[132px] flex flex-col gap-0.5 rounded-xl border border-line bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(23,31,40,0.3)]"
                style={{ left: repeatMenuPosition.left, top: repeatMenuPosition.top }}
              >
                {([
                  [null, "반복 없음"],
                  ["monthly", "매월"],
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
                        onChange({ scheduledAt: value.scheduledAt, recurrenceMode: mode });
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
    </div>
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
