"use client";

import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon } from "@/components/icons";
import { FieldLabel } from "./FieldLabel";

/** Prototype `.dp` date control: 42px field + inline 262px month calendar. */
export function DateField({
  label,
  required,
  placeholder = "YYYY.MM.DD",
  value,
  onChange,
  full,
  error,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  full?: boolean;
  /** 필드 아래에 보여 줄 검증 오류. */
  error?: string;
}) {
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="pt-[6px]">
        <DpDatePicker
          value={value ?? ""}
          onChange={(nextValue) => onChange?.(nextValue)}
          placeholder={placeholder}
          ariaLabel={label}
          className="w-full"
          triggerClassName={`flex h-[42px] w-full items-center justify-between gap-[8px] rounded-[10px] border bg-surface px-[13px] text-[13.5px] font-semibold leading-[normal] text-t1 outline-none ${error ? "border-red" : "border-line"}`}
          triggerOpenClassName="border-teal shadow-[0_0_0_3px_var(--color-teal-t)]"
          endAdornment={<CalendarIcon variant="building-register" className="size-[16px] shrink-0 text-t3" />}
        />
        {error && (
          <p role="alert" className="pt-[6px] text-[12px] font-semibold leading-[normal] text-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
