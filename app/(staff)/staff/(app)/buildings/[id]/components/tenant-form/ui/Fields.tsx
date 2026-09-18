"use client";
import React, { useEffect, useRef, useState } from "react";
import { applyPhoneFormat, PHONE_INPUT_ATTRS } from "@/components/common";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad2 = (n: number) => String(n).padStart(2, "0");

function parseDate(value: string | undefined): [number, number, number] | null {
  if (!value) return null;
  const parts = value.split(/[.-]/).map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null;
  return [parts[0], parts[1], parts[2]];
}
function fmtDate(value: string | undefined): string {
  const p = parseDate(value);
  return p ? `${p[0]}.${pad2(p[1])}.${pad2(p[2])}` : "";
}

/** 2열 필드 그리드 (Figma: grid-cols-2 gap-x-[18px] gap-y-[16px]). full 필드는 col-span-2. */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-[18px] gap-y-[16px] md:grid-cols-2">{children}</div>;
}

/** 라벨 + (선택)필수표시 + 입력 컨트롤 + (선택)에러. */
export function Field({
  label,
  required,
  full,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col ${full ? "md:col-span-2" : ""}`}>
      <span className="text-[12.5px] font-bold text-t2">
        {label}
        {required && <span className="text-red"> *</span>}
      </span>
      <div className="pt-[6px]">{children}</div>
      {error && <span className="pt-[4px] text-[11px] text-red">{error}</span>}
    </label>
  );
}

const boxBase =
  "h-[42px] w-full rounded-[10px] border border-line bg-white px-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_3px_#e2f5f1]";

export const TextField = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: "text" | "number" | "password";
    muted?: boolean;
    /** "phone"이면 숫자만 받고 하이픈을 자동으로 붙인다(`components/common/phoneField`). */
    format?: "phone";
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">
>(function TextField({ value, onChange, placeholder, type = "text", muted, format, ...rest }, ref) {
  const isPhone = format === "phone";
  return (
    <input
      ref={ref}
      {...(isPhone ? PHONE_INPUT_ATTRS : { type })}
      value={value}
      onChange={(e) => onChange(isPhone ? applyPhoneFormat(e.currentTarget) : e.target.value)}
      placeholder={placeholder}
      readOnly={muted}
      className={`${boxBase} text-[13.5px] font-semibold text-t1 placeholder:font-medium placeholder:text-t4 ${muted ? "bg-[#f2f4f6] text-t3" : ""}`}
      {...rest}
    />
  );
});

/** 원본 `.amt-in`: 천단위 콤마 표시 + 숫자만 저장. */
export function AmountField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const digits = value.replace(/[^\d]/g, "");
  const display = digits === "" ? "" : Number(digits).toLocaleString("en-US");
  return (
    <input
      inputMode="numeric"
      value={display}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
      placeholder={placeholder}
      className={`${boxBase} text-[13.5px] font-semibold text-t1 placeholder:font-medium placeholder:text-t4`}
    />
  );
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-h-[80px] w-full resize-y rounded-[10px] border border-line bg-white px-[13px] py-[11px] text-[13.5px] font-semibold leading-[1.5] text-t1 outline-none placeholder:font-medium placeholder:text-t4 focus:border-brand focus:shadow-[0_0_0_3px_#e2f5f1]"
    />
  );
}

/** 원본 `.dd` 커스텀 드롭다운: 42px 컨트롤 + 팝오버(외부클릭 닫힘·선택 하이라이트). */
export function SelectField({
  value,
  onChange,
  options,
  placeholder = "선택",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-[42px] w-full items-center justify-between gap-[8px] rounded-[10px] border bg-white px-[13px] text-left outline-none ${
          open ? "border-brand shadow-[0_0_0_3px_#e2f5f1]" : "border-line"
        }`}
      >
        <span className={`text-[13.5px] leading-[normal] ${selected ? "font-semibold text-t1" : "font-medium text-t4"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-t3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+5px)] z-[90] max-h-[240px] overflow-auto rounded-[12px] border border-line bg-white p-[6px] shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)]"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center whitespace-nowrap rounded-[8px] px-[11px] py-[9px] text-left text-[13.5px] leading-[normal] ${
                o.value === value ? "bg-teal-t font-bold text-teal" : "font-semibold text-t2 hover:bg-bg"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 원본 `.dp` 데이트피커: 42px 컨트롤 + 인라인 262px 월 달력. */
export function DateField({
  value,
  onChange,
  placeholder = "날짜 선택",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const sel = parseDate(value);
    const now = new Date();
    return sel ? { year: sel[0], month: sel[1] - 1 } : { year: now.getFullYear(), month: now.getMonth() };
  });
  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);
  const selected = parseDate(value);
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const days = new Date(view.year, view.month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const toggle = () => {
    if (!open && selected) setView({ year: selected[0], month: selected[1] - 1 });
    setOpen((o) => !o);
  };
  const shift = (delta: number) =>
    setView((cur) => {
      const next = cur.month + delta;
      return { year: cur.year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
    });
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={placeholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className={`flex h-[42px] w-full items-center justify-between gap-[8px] rounded-[10px] border bg-white px-[13px] text-left text-[13.5px] outline-none ${
          open ? "border-brand shadow-[0_0_0_3px_#e2f5f1]" : "border-line"
        }`}
      >
        <span className={selected ? "font-semibold text-t1" : "font-medium text-t4"}>
          {fmtDate(value) || placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0 text-t3"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${placeholder} 달력`}
          className="absolute left-0 top-[calc(100%+5px)] z-[95] w-[262px] rounded-[14px] border border-line bg-white p-[14px] shadow-[0_16px_40px_-12px_rgba(23,31,40,0.28)]"
        >
          <div className="mb-[10px] flex items-center justify-between">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => shift(-1)}
              className="flex size-[30px] items-center justify-center rounded-[8px] text-[17px] leading-[normal] text-t2 hover:bg-bg"
            >
              ‹
            </button>
            <span className="text-[14px] font-extrabold leading-[normal] text-t1">
              {view.year}.{pad2(view.month + 1)}
            </span>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => shift(1)}
              className="flex size-[30px] items-center justify-center rounded-[8px] text-[17px] leading-[normal] text-t2 hover:bg-bg"
            >
              ›
            </button>
          </div>
          <div className="mb-[4px] grid grid-cols-7">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-[4px] text-center text-[11px] font-bold leading-[normal] text-t4">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-[2px]">
            {cells.map((day, i) =>
              day === null ? (
                <span key={`e-${i}`} className="h-[32px]" />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onChange(`${view.year}-${pad2(view.month + 1)}-${pad2(day)}`);
                    setOpen(false);
                  }}
                  className={`flex h-[32px] items-center justify-center rounded-[8px] text-[13px] font-semibold leading-[normal] ${
                    selected &&
                    selected[0] === view.year &&
                    selected[1] === view.month + 1 &&
                    selected[2] === day
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
  );
}
