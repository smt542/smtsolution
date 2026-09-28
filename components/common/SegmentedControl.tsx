import React from "react";

export type SegmentedControlOption = {
  value: string;
  label: string;
};

export type SegmentedControlProps = {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "md" | "sm";
};

export function SegmentedControl({
  options,
  value,
  onChange,
  disabled = false,
  className = "",
  size = "md",
}: SegmentedControlProps) {
  // 정본 `.adj-seg2`의 sm 규격과 기존 md 규격을 분리한다.
  const containerSizeClass =
    size === "sm"
      ? "inline-flex gap-[2px] rounded-[9px] bg-[#edf0f3] p-[3px]"
      : "inline-flex gap-[2px] rounded-[10px] bg-[#edf0f3] p-[3px]";
  const buttonSizeClass =
    size === "sm"
      ? "h-[24px] rounded-[7px] px-[11px] text-[12px] font-bold leading-[normal]"
      : "h-[34px] rounded-[8px] px-[16px] text-[13.5px] font-bold";

  return (
    <div
      role="radiogroup"
      className={`${containerSizeClass} ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const selectedClass =
          size === "sm"
            ? "bg-white text-t1"
            : "bg-white text-t1 drop-shadow-[0px_2px_3px_rgba(23,31,40,0.1)]";
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`${buttonSizeClass} ${selected ? selectedClass : "text-t3"} disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
