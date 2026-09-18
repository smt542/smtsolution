import { CalendarIcon } from "@/components/icons";
import { DpDatePicker } from "@/components/common/DpDatePicker";

interface SettlementDateFieldProps {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
}

export function SettlementDateField({
  ariaLabel,
  value,
  onChange,
}: SettlementDateFieldProps) {
  return (
    <DpDatePicker
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      placeholder="날짜 선택"
      triggerClassName="flex h-[30px] w-[116px] items-center justify-between rounded-[8px] border border-line bg-white px-[9px] text-[12.5px] font-medium text-t1 outline-none"
      triggerOpenClassName="border-blue shadow-[0_0_0_3px_var(--color-blue-t)]"
      endAdornment={<CalendarIcon className="size-[13px] shrink-0 text-t3" aria-hidden="true" />}
    />
  );
}
