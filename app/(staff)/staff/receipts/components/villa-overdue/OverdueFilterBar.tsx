import type { OverdueScope } from "@/hooks/reactquery/overdue";
import { ChevronDownIcon } from "@/components/icons";
import { padMonthCount } from "./format";

interface OverdueFilterBarProps {
  year: number;
  month: number;
  minOverdue: number;
  scope: OverdueScope;
  onYear: (year: number) => void;
  onMonth: (month: number) => void;
  onMinOverdue: (value: number) => void;
  onScope: (scope: OverdueScope) => void;
}

function ChipSelect({
  value,
  onChange,
  options,
  ariaLabel,
  width,
}: {
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
  ariaLabel: string;
  width: number;
}) {
  return (
    <div className="relative" style={{ width }}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-[32px] w-full appearance-none rounded-[10px] border border-line bg-surface pl-[12px] pr-[28px] text-[13px] font-medium text-t1 focus:border-teal focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-[9px] top-1/2 -translate-y-1/2 text-t3" />
    </div>
  );
}

export function OverdueFilterBar({
  year,
  month,
  minOverdue,
  scope,
  onYear,
  onMonth,
  onMinOverdue,
  onScope,
}: OverdueFilterBarProps) {
  const yearOptions = Array.from({ length: 6 }, (_, index) => year - 4 + index).map(
    (value) => ({ value, label: `${value}년` }),
  );
  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1).map((value) => ({
    value,
    label: `${value}월`,
  }));
  const minOverdueOptions = Array.from({ length: 13 }, (_, index) => index).map((value) => ({
    value,
    label: padMonthCount(value),
  }));

  return (
    <div className="flex h-[59px] shrink-0 items-center gap-[7px] border-b border-line px-[16px]">
      <ChipSelect
        ariaLabel="조회 연도"
        value={year}
        onChange={onYear}
        options={yearOptions}
        width={88}
      />
      <ChipSelect
        ariaLabel="조회 월"
        value={month}
        onChange={onMonth}
        options={monthOptions}
        width={64}
      />
      <span className="px-[2px] text-[12px] text-t3">까지</span>
      <span className="text-[12px] text-t3">연체</span>
      <ChipSelect
        ariaLabel="연체 개월 하한"
        value={minOverdue}
        onChange={onMinOverdue}
        options={minOverdueOptions}
        width={62}
      />

      <div className="flex-1" />

      <div className="flex h-[30px] items-center rounded-[8px] bg-bg p-[3px]">
        {(
          [
            { value: "all", label: "전체" },
            { value: "current", label: "당계" },
          ] as const
        ).map((option) => {
          const active = scope === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onScope(option.value)}
              className={`h-[24px] rounded-[6px] px-[13px] text-[12px] font-medium transition ${
                active ? "bg-surface text-t1 shadow-sm" : "text-t3 hover:text-t2"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
