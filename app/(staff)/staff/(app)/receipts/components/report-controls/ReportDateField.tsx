import { DpDatePicker } from "@/components/common/DpDatePicker";
import { DpMonthPicker } from "@/components/common/DpMonthPicker";
import { CalendarIcon } from "@/components/icons";

interface ReportDateFieldProps {
  type: "date" | "month";
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
}

export function ReportDateField({
  type,
  value,
  onValueChange,
  ariaLabel,
  size = "sm",
  placeholder,
  className = "w-[116px]",
  min,
  max,
}: ReportDateFieldProps) {
  // 빈 값의 placeholder 색(text-t4)은 피커가 값 span에 직접 입힌다
  const valueSizeClassName = size === "md" ? "text-[13.5px]" : "text-[12.5px]";
  const triggerClassName = `flex h-[38px] cursor-pointer items-center rounded-[10px] border border-line bg-surface px-[11px] ${valueSizeClassName} font-medium text-t1 outline-none focus-visible:border-teal ${className}`;
  const pickerProps = {
    value,
    ariaLabel,
    placeholder: placeholder ?? "",
    onChange: onValueChange,
    triggerClassName,
    triggerOpenClassName: "border-teal",
    endAdornment: <CalendarIcon className="ml-auto size-[15px] shrink-0 text-t3" aria-hidden="true" />,
  };

  return type === "date" ? (
    <DpDatePicker
      {...pickerProps}
      minDate={min || undefined}
      maxDate={max || undefined}
    />
  ) : (
    <DpMonthPicker
      {...pickerProps}
      minMonth={min || undefined}
      maxMonth={max || undefined}
    />
  );
}
