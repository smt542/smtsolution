"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DpTimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  triggerOpenClassName?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  className?: string;
  minuteStep?: number;
  displayFormatter?: (value: string) => string;
}

type Period = "오전" | "오후";
type TimeParts = { ap: Period; h: number; m: number };
type PickerPosition = { left: number; top: number; maxHeight: number };

const DEFAULT_TIME: TimeParts = { ap: "오전", h: 9, m: 0 };
const PERIODS: Period[] = ["오전", "오후"];
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const pad = (value: number) => String(value).padStart(2, "0");

function parseTime(value: string): TimeParts | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return {
    ap: hour < 12 ? "오전" : "오후",
    h: hour % 12 || 12,
    m: minute,
  };
}

function toTimeValue({ ap, h, m }: TimeParts): string {
  const hour = ap === "오전" ? h % 12 : h === 12 ? 12 : h + 12;
  return `${pad(hour)}:${pad(m)}`;
}

function formatTime({ ap, h, m }: TimeParts): string {
  return `${ap} ${h}:${pad(m)}`;
}

export function DpTimePicker({
  id,
  value,
  onChange,
  placeholder = "시간",
  disabled = false,
  ariaLabel,
  triggerClassName,
  triggerOpenClassName,
  startAdornment,
  endAdornment,
  className,
  minuteStep = 5,
  displayFormatter,
}: DpTimePickerProps) {
  const ctlRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PickerPosition | null>(null);
  const [timeParts, setTimeParts] = useState<TimeParts>(DEFAULT_TIME);
  const centeredOnOpenRef = useRef(false);
  const selectedTime = parseTime(value);
  const safeMinuteStep = Number.isFinite(minuteStep) && minuteStep > 0 ? Math.max(1, Math.floor(minuteStep)) : 5;
  const minutes = Array.from({ length: Math.ceil(60 / safeMinuteStep) }, (_, index) => index * safeMinuteStep).filter(
    (minute) => minute < 60,
  );

  useEffect(() => {
    if (!open) return;

    const placePicker = () => {
      const trigger = ctlRef.current;
      if (!trigger) return;

      const menu = popRef.current;
      const rect = trigger.getBoundingClientRect();
      const menuHeight = menu?.offsetHeight ?? 208;
      const menuWidth = menu?.offsetWidth ?? 232;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      let top: number;
      let maxHeight: number;

      if (below >= menuHeight || below >= above) {
        top = rect.bottom + 6;
        maxHeight = Math.max(200, below);
      } else {
        maxHeight = Math.max(200, above);
        top = Math.max(12, rect.top - 6 - Math.min(menuHeight, above));
      }

      const left = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12));
      setPos((current) =>
        current?.left === left && current.top === top && current.maxHeight === maxHeight
          ? current
          : { left, top, maxHeight },
      );
    };

    placePicker();
    const frame = window.requestAnimationFrame(placePicker);
    window.addEventListener("scroll", placePicker, true);
    window.addEventListener("resize", placePicker);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", placePicker, true);
      window.removeEventListener("resize", placePicker);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // 바깥 탭 닫기 — iOS Safari 대응으로 mousedown 대신 pointerdown(DpDatePicker와 동일)
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ctlRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        ctlRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      centeredOnOpenRef.current = false;
      return;
    }
    if (!pos || centeredOnOpenRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const menu = popRef.current;
      if (!menu) return;
      menu.querySelectorAll<HTMLElement>(".tp-col").forEach((column) => {
        const selected = column.querySelector<HTMLElement>(".tp-opt.on");
        if (selected) {
          column.scrollTop = selected.offsetTop - column.clientHeight / 2 + selected.offsetHeight / 2;
        }
      });
      centeredOnOpenRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, pos]);

  const openPicker = () => {
    setTimeParts(selectedTime ?? DEFAULT_TIME);
    setOpen(true);
  };
  const commit = (next: TimeParts) => {
    setTimeParts(next);
    onChange(toTimeValue(next));
  };

  const displayValue = selectedTime
    ? displayFormatter
      ? displayFormatter(value)
      : formatTime(selectedTime)
    : placeholder;

  return (
    <div className={`relative inline-flex${className ? ` ${className}` : ""}`}>
      <button
        ref={ctlRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={triggerClassName
          ? `${triggerClassName} ${open ? triggerOpenClassName ?? "" : ""}`
          : `flex h-[28px] min-w-[106px] items-center justify-center gap-1.5 rounded-[8px] border px-[10px] text-[12px] font-medium outline-none ${
            disabled ? "cursor-default border-line2 bg-bg" : "cursor-pointer border-line bg-white"
          } ${open ? "border-blue shadow-[0_0_0_3px_var(--color-blue-t)]" : ""} ${selectedTime ? "text-t1" : "text-t4"}`}
      >
        {startAdornment}
        <span className={triggerClassName && !selectedTime ? "font-medium text-t4" : ""}>{displayValue}</span>
        {endAdornment}
      </button>

      {open && !disabled && pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="시간 선택"
            className="fixed z-[200] w-[232px] overflow-auto rounded-[14px] border border-line bg-white p-0 shadow-[0_16px_40px_-12px_rgba(23,31,40,0.3)]"
            style={{ left: pos.left, top: pos.top, maxHeight: pos.maxHeight }}
          >
            <div className="tp3 flex h-[206px] gap-[4px] p-[8px]">
              <div role="listbox" aria-label="오전·오후" className="tp-col flex flex-1 flex-col gap-[2px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:w-0">
                {PERIODS.map((period) => {
                  const selected = timeParts.ap === period;
                  return (
                    <button
                      key={period}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`tp-opt shrink-0 rounded-[8px] px-[6px] py-[8px] text-center text-[13px] font-bold text-t2 hover:bg-bg ${
                        selected ? "on bg-blue-t2 text-blue-d" : ""
                      }`}
                      onClick={() => commit({ ...timeParts, ap: period })}
                    >
                      {period}
                    </button>
                  );
                })}
              </div>

              <div role="listbox" aria-label="시" className="tp-col flex flex-1 flex-col gap-[2px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:w-0">
                {HOURS.map((hour) => {
                  const selected = timeParts.h === hour;
                  return (
                    <button
                      key={hour}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`tp-opt shrink-0 rounded-[8px] px-[6px] py-[8px] text-center text-[13px] font-bold text-t2 hover:bg-bg ${
                        selected ? "on bg-blue-t2 text-blue-d" : ""
                      }`}
                      onClick={() => commit({ ...timeParts, h: hour })}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>

              <div role="listbox" aria-label="분" className="tp-col flex flex-1 flex-col gap-[2px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:w-0">
                {minutes.map((minute) => {
                  const selected = timeParts.m === minute;
                  return (
                    <button
                      key={minute}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`tp-opt shrink-0 rounded-[8px] px-[6px] py-[8px] text-center text-[13px] font-bold text-t2 hover:bg-bg ${
                        selected ? "on bg-blue-t2 text-blue-d" : ""
                      }`}
                      onClick={() => commit({ ...timeParts, m: minute })}
                    >
                      {pad(minute)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
