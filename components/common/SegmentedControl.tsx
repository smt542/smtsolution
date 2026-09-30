import React from "react";

export type SegmentedControlOption = {
  value: string;
  label: string;
};

export type SegmentedControlProps = {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  /** 정본 `.st-seg.lock` 잠금 모양: 틀 #EEF1F4+테두리, 선택 #E3E7EB·t3, 나머지 #AEB6BF·600. */
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
      ? "inline-flex gap-[2px] rounded-[9px] p-[3px]"
      : "inline-flex gap-[2px] rounded-[10px] p-[3px]";
  const containerToneClass = disabled ? "border border-line2 bg-[#EEF1F4]" : "bg-[#edf0f3]";
  const buttonSizeClass =
    size === "sm"
      ? "h-[24px] rounded-[7px] px-[11px] text-[12px] leading-[normal]"
      : "h-[34px] rounded-[8px] px-[16px] text-[13.5px]";

  return (
    <div
      role="radiogroup"
      className={`${containerSizeClass} ${containerToneClass} ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        // 굵기·색은 상태마다 하나만 둔다(같은 속성 유틸이 둘 남으면 CSS 생성 순서가 이긴다).
        const stateClass = disabled
          ? selected
            ? "bg-[#E3E7EB] font-bold text-t3"
            : "font-semibold text-[#AEB6BF]"
          : selected
            ? size === "sm"
              ? "bg-white font-bold text-t1"
              : "bg-white font-bold text-t1 drop-shadow-[0px_2px_3px_rgba(23,31,40,0.1)]"
            : "font-bold text-t3";
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`${buttonSizeClass} ${stateClass} disabled:cursor-default`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
