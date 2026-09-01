import { CalendarIcon } from "@/components/icons";

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
    <label className="relative block h-[30px] w-[116px]">
      <input
        aria-label={ariaLabel}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`settlement-date-input h-[30px] w-[116px] rounded-[8px] border border-line bg-white pl-[9px] pr-[30px] text-[12.5px] font-medium tabular-nums outline-none transition-colors focus:border-blue ${
          value ? "text-t1" : "text-transparent"
        }`}
      />
      {!value && (
        <span className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[12.5px] font-medium text-t4">
          날짜 선택
        </span>
      )}
      <CalendarIcon className="pointer-events-none absolute right-[9px] top-1/2 size-[13px] -translate-y-1/2 text-t3" />
    </label>
  );
}
