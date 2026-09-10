"use client";

import { useEffect, useRef, useState } from "react";
import { FieldLabel } from "./FieldLabel";
import { CalendarIcon } from "@/components/icons";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (value: number) => String(value).padStart(2, "0");

function parseValue(value: string | undefined): [number, number, number] | null {
  if (!value) return null;
  const parts = value.split(/[.-]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return [parts[0], parts[1], parts[2]];
}

function displayValue(value: string | undefined): string {
  const parsed = parseValue(value);
  return parsed ? `${parsed[0]}.${pad(parsed[1])}.${pad(parsed[2])}` : "";
}

/** Prototype `.dp` date control: 42px field + inline 262px month calendar. */
export function DateField({
  label,
  required,
  placeholder = "YYYY.MM.DD",
  value,
  onChange,
  full,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  full?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const selected = parseValue(value);
    const now = new Date();
    return selected ? { year: selected[0], month: selected[1] - 1 } : { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const selected = parseValue(value);
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const days = new Date(view.year, view.month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];

  const toggle = () => {
    if (!open && selected) setView({ year: selected[0], month: selected[1] - 1 });
    setOpen((current) => !current);
  };
  const shift = (delta: number) =>
    setView((current) => {
      const next = current.month + delta;
      return {
        year: current.year + Math.floor(next / 12),
        month: ((next % 12) + 12) % 12,
      };
    });

  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div ref={rootRef} className="relative pt-[6px]">
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggle}
          className={`flex h-[42px] w-full items-center justify-between gap-[8px] rounded-[10px] border bg-surface px-[13px] text-[13.5px] font-semibold leading-[normal] outline-none ${
            open ? "border-teal shadow-[0_0_0_3px_var(--color-teal-t)]" : "border-line"
          }`}
        >
          <span className={selected ? "text-t1" : "font-medium text-t4"}>{displayValue(value) || placeholder}</span>
          <CalendarIcon variant="building-register" className="size-[16px] shrink-0 text-t3" />
        </button>

        {open && (
          <div
            role="dialog"
            aria-label={`${label} 달력`}
            className="absolute left-0 top-[calc(100%+5px)] z-[95] w-[262px] rounded-[14px] border border-line bg-surface p-[14px] shadow-[0_16px_40px_-12px_rgba(23,31,40,0.28)]"
          >
            <div className="mb-[10px] flex items-center justify-between">
              <button type="button" aria-label="이전 달" onClick={() => shift(-1)} className="flex size-[30px] items-center justify-center rounded-[8px] text-[17px] leading-[normal] text-t2 hover:bg-bg">
                ‹
              </button>
              <span className="text-[14px] font-extrabold leading-[normal] text-t1">
                {view.year}.{pad(view.month + 1)}
              </span>
              <button type="button" aria-label="다음 달" onClick={() => shift(1)} className="flex size-[30px] items-center justify-center rounded-[8px] text-[17px] leading-[normal] text-t2 hover:bg-bg">
                ›
              </button>
            </div>
            <div className="mb-[4px] grid grid-cols-7">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="py-[4px] text-center text-[11px] font-bold leading-[normal] text-t4">
                  {weekday}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-[2px]">
              {cells.map((day, index) =>
                day === null ? (
                  <span key={`empty-${index}`} className="h-[32px]" />
                ) : (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      onChange?.(`${view.year}-${pad(view.month + 1)}-${pad(day)}`);
                      setOpen(false);
                    }}
                    className={`flex h-[32px] items-center justify-center rounded-[8px] text-[13px] font-semibold leading-[normal] ${
                      selected && selected[0] === view.year && selected[1] === view.month + 1 && selected[2] === day
                        ? "bg-teal font-bold text-white"
                        : "text-t1 hover:bg-blue-t2"
                    }`}
                  >
                    {day}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
