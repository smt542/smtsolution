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
};

export function SegmentedControl({
  options,
  value,
  onChange,
  disabled = false,
  className = "",
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex gap-[2px] rounded-[10px] bg-[#edf0f3] p-[3px] ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`h-[34px] rounded-[8px] px-[16px] text-[13.5px] font-bold ${
              selected
                ? "bg-white text-t1 drop-shadow-[0px_2px_3px_rgba(23,31,40,0.1)]"
                : "text-t3"
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
