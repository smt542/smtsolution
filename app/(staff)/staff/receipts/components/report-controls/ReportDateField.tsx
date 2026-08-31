import type { InputHTMLAttributes } from "react";
import { CalendarIcon } from "@/components/icons";

type NativeDateProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "className"
>;

export function ReportDateField({
  type,
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  className = "w-[116px]",
  ...props
}: NativeDateProps & {
  type: "date" | "month";
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const displayValue = value ? value.replaceAll("-", ".") : placeholder ?? "";

  return (
    <label
      className={`relative flex h-[38px] cursor-pointer items-center rounded-[10px] border border-line bg-surface px-[11px] text-[12.5px] font-medium focus-within:border-teal ${className}`}
    >
      <span className={value ? "text-t1" : "text-t4"}>{displayValue}</span>
      <CalendarIcon className="ml-auto size-[15px] shrink-0 text-t3" aria-hidden="true" />
      <input
        {...props}
        type={type}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onValueChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
