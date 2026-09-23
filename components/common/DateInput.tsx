import { DpDatePicker } from "./DpDatePicker";
import { DpTimePicker } from "./DpTimePicker";
import { inputClassName, type InputSize } from "./Input";
import { CalendarIcon, ClockIcon } from "@/components/icons";

interface PickerInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: InputSize;
  className?: string;
}

export interface DateInputProps extends PickerInputProps {
  minDate?: string;
  maxDate?: string;
}

export interface TimeInputProps extends PickerInputProps {
  minuteStep?: number;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** datetime-local 값("YYYY-MM-DDTHH:MM")을 날짜·시간 피커 값으로 나눈다 */
export function splitDateTimeLocal(value: string): { date: string; time: string } {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? { date: match[1], time: match[2] } : { date: "", time: "" };
}

/**
 * 날짜·시간 피커 값을 datetime-local 값으로 합친다. 한쪽만 고르면 나머지를 채워 반쪽 값이 버려지지
 * 않게 한다(시간 = DpTimePicker 기본값 09:00, 날짜 = 오늘).
 */
export function joinDateTimeLocal(date: string, time: string): string {
  if (!date && !time) return "";
  return `${date || todayLocal()}T${time || "09:00"}`;
}

function pickerRootClassName(className: string): string {
  const widthClass = className.split(/\s+/).find((token) => /^!?w-/.test(token));
  return widthClass ?? "w-full";
}

const pickerTriggerClassName = (size: InputSize, className: string) =>
  `${inputClassName(size, className)} flex items-center gap-2 text-left cursor-pointer disabled:cursor-default`;

export function DateInput({
  id,
  value,
  onChange,
  ariaLabel,
  placeholder = "날짜 선택",
  disabled = false,
  size = "legacy",
  className = "",
  minDate,
  maxDate,
}: DateInputProps) {
  return (
    <DpDatePicker
      id={id}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      minDate={minDate}
      maxDate={maxDate}
      className={pickerRootClassName(className)}
      triggerClassName={pickerTriggerClassName(size, className)}
      triggerOpenClassName="border-brand"
      endAdornment={<CalendarIcon className="ml-auto size-4 shrink-0 text-t3" aria-hidden="true" />}
    />
  );
}

export function TimeInput({
  id,
  value,
  onChange,
  ariaLabel,
  placeholder = "시간 선택",
  disabled = false,
  size = "legacy",
  className = "",
  minuteStep,
}: TimeInputProps) {
  return (
    <DpTimePicker
      id={id}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      minuteStep={minuteStep}
      className={pickerRootClassName(className)}
      triggerClassName={pickerTriggerClassName(size, className)}
      triggerOpenClassName="border-brand"
      endAdornment={<ClockIcon className="ml-auto size-4 shrink-0 text-t3" aria-hidden="true" />}
    />
  );
}
