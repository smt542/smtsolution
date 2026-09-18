import React from "react";

export type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function Switch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  className = "",
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[44px] rounded-[999px] transition-colors ${
        checked ? "bg-brand" : "bg-[#c9d0d8]" // off 색은 토큰 문서에서 미실측 — 알림 탭 확인 필요
      } disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[3px] h-[20px] w-[20px] rounded-[10px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.2)] transition-[left] ${
          checked ? "left-[21px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}
