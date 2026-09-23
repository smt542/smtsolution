"use client";
import React, { useEffect, useRef, useState } from "react";
import { applyMask, type InputMask, NUMERIC_INPUT_ATTRS } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";

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
    /** 숫자 입력에 구분자를 끼우는 마스크(`components/common/maskedField`의 phoneMask 등). */
    mask?: InputMask;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">
>(function TextField({ value, onChange, placeholder, type = "text", muted, mask, ...rest }, ref) {
  return (
    <input
      ref={ref}
      {...(mask ? NUMERIC_INPUT_ATTRS : { type })}
      value={value}
      onChange={(e) => onChange(mask ? applyMask(e.currentTarget, mask) : e.target.value)}
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
  return (
    <div>
      <DpDatePicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        ariaLabel={placeholder}
        className="w-full"
        triggerClassName="flex h-[42px] w-full items-center justify-between gap-[8px] rounded-[10px] border border-line bg-white px-[13px] text-left text-[13.5px] font-semibold text-t1 outline-none"
        triggerOpenClassName="border-brand shadow-[0_0_0_3px_#e2f5f1]"
        endAdornment={(
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
        )}
      />
    </div>
  );
}
