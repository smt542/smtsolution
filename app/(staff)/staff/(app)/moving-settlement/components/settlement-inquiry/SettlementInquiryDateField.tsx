import { CalendarIcon } from "@/components/icons";

interface SettlementInquiryDateFieldProps {
  ariaLabel: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

export function SettlementInquiryDateField({
  ariaLabel,
  value,
  onChange,
}: SettlementInquiryDateFieldProps) {
  return (
    <label className="relative flex h-[30px] w-[116px] cursor-pointer items-center justify-between rounded-[8px] border border-line bg-white px-[9px]">
      <span className={`text-[12.5px] font-medium ${value ? "text-t1" : "text-t4"}`}>
        {value ? value.replaceAll("-", ".") : "날짜 선택"}
      </span>
      <CalendarIcon className="size-[13px] shrink-0 text-t3" />
      <input
        type="date"
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
