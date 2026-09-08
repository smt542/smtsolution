"use client";
import React from "react";
import { ChevronDownIcon, CalendarIcon } from "@/components/icons";

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
  "h-[42px] w-full rounded-[10px] border border-line bg-white px-[13px] outline-none focus:border-brand";

export const TextField = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: "text" | "number" | "password";
    muted?: boolean;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">
>(function TextField({ value, onChange, placeholder, type = "text", muted, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={muted}
      className={`${boxBase} text-[16px] font-medium text-t1 placeholder:text-t4 ${muted ? "bg-[#f2f4f6]" : ""}`}
      {...rest}
    />
  );
});

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
      className="min-h-[80px] w-full resize-none rounded-[10px] border border-line bg-white px-[13px] py-[11px] text-[16px] font-medium leading-[24px] text-t1 outline-none placeholder:text-t4 focus:border-brand"
    />
  );
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${boxBase} appearance-none pr-[36px] text-[13.5px] font-semibold ${
          value ? "text-t1" : "text-t4"
        }`}
      >
        {placeholder !== undefined && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-t1">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-[13px] top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-t3" />
    </div>
  );
}

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
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${boxBase} pr-[36px] text-[13.5px] font-medium [&::-webkit-calendar-picker-indicator]:opacity-0 ${
          value ? "text-t1" : "text-t4"
        }`}
        aria-label={placeholder}
      />
      <CalendarIcon className="pointer-events-none absolute right-[13px] top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-t3" />
    </div>
  );
}
