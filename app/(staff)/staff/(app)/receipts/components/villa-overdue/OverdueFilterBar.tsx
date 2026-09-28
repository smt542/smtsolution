import type { OverdueScope } from "@/hooks/reactquery/overdue";
import { CustomDropdown, type DropdownOption } from "@/components/common/CustomDropdown";
import { SegmentedControl } from "@/components/common/SegmentedControl";
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
  const yearOptions: DropdownOption[] = Array.from(
    { length: 6 },
    (_, index) => year - 4 + index,
  ).map((value) => ({ value: String(value), label: `${value}년` }));
  const monthOptions: DropdownOption[] = Array.from({ length: 12 }, (_, index) => index + 1).map(
    (value) => ({ value: String(value), label: `${value}월` }),
  );
  const minOverdueOptions: DropdownOption[] = Array.from({ length: 37 }, (_, index) => index).map(
    (value) => ({ value: String(value), label: padMonthCount(value) }),
  );

  return (
    <div className="relative z-[5] flex shrink-0 flex-wrap items-center gap-[8px] border-b border-line bg-surface px-[16px] py-[13px]">
      {/* 정본 `.auto-bar`의 compact `.uc-dd`와 `.auto-lbl` 필터 규격을 사용한다. */}
      <CustomDropdown
        ariaLabel="조회 연도"
        value={String(year)}
        options={yearOptions}
        onChange={(value) => onYear(Number(value))}
        size="compact"
        position="fixed"
        menuMinWidth={104}
      />
      <CustomDropdown
        ariaLabel="조회 월"
        value={String(month)}
        options={monthOptions}
        onChange={(value) => onMonth(Number(value))}
        size="compact"
        position="fixed"
        menuMinWidth={104}
      />
      <span className="text-[12px] font-bold text-t3">까지</span>
      <span className="ml-[6px] text-[12px] font-bold text-t3">연체</span>
      <CustomDropdown
        ariaLabel="연체 개월 하한"
        value={String(minOverdue)}
        options={minOverdueOptions}
        onChange={(value) => onMinOverdue(Number(value))}
        size="compact"
        position="fixed"
        menuMinWidth={96}
      />

      <div className="flex-1" />

      <SegmentedControl
        options={[
          { value: "all", label: "전체" },
          { value: "current", label: "당계" },
        ]}
        value={scope}
        onChange={(value) => {
          if (value === "all" || value === "current") onScope(value);
        }}
        size="sm"
      />
    </div>
  );
}
