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
