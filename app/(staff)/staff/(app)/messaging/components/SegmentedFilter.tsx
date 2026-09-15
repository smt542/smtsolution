"use client";

interface SegmentedFilterOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedFilterProps<T extends string> {
  options: SegmentedFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible label for the segment group. */
  ariaLabel?: string;
}

/**
 * 메시징 탭 공용 세그먼트 필터(프로토타입 `.adj-seg2`).
 * 예약 발송·발송 내역·템플릿 관리 탭이 동일한 필터 UI를 공유한다.
 */
export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedFilterProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-[2px] rounded-[9px] bg-[#edf0f3] p-[3px]"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={
            value === option.value
              ? "whitespace-nowrap rounded-[7px] bg-white px-[11px] py-[5px] text-[12px] font-bold leading-normal text-[#191f28] shadow-[0px_1px_3px_rgba(23,31,40,0.1)] transition-colors"
              : "whitespace-nowrap rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold leading-normal text-[#8b95a1] transition-colors"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
