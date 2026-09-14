"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon } from "@/components/icons";

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  ariaLabel: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: "default" | "compact";
  compact?: boolean;
}

export function CustomDropdown({
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  size = "default",
  compact = false,
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];
  const isCompact = size === "compact" || compact;

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  // 프로토타입 공통 커스텀 드롭다운. 스타일은 Tailwind 유틸로 인라인화하되,
  // uc-dd/uc-dd-btn/uc-dd-menu/uc-opt 클래스명은 호출부의 [&_.uc-dd-btn]:… 오버라이드가
  // 계속 바인딩되도록 셀렉터 훅으로 유지한다(전역 CSS는 제거).
  return (
    <div
      ref={rootRef}
      className={`uc-dd ${isCompact ? "uc-dd--compact" : ""} ${open ? "open" : ""} relative flex-none`}
    >
      <button
        type="button"
        className={`uc-dd-btn inline-flex ${isCompact ? "h-8" : "h-9"} items-center gap-[7px] rounded-[9px] border ${open ? "border-blue" : "border-line"} bg-surface py-0 pr-[10px] pl-[11px] text-[13px] font-bold tracking-[-0.01em] text-t1 outline-none transition-[border-color,box-shadow] duration-[120ms] hover:border-blue hover:shadow-[0_0_0_3px_var(--color-blue-t)] disabled:cursor-default disabled:opacity-[.55] disabled:shadow-none [&_svg]:h-[15px] [&_svg]:w-[15px] ${open ? "shadow-[0_0_0_3px_var(--color-blue-t)]" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="uc-dd-lbl">{selected?.label}</span>
        <ChevronDownIcon aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          className="uc-dd-menu absolute right-0 top-[calc(100%_+_6px)] z-[80] max-h-[236px] min-w-[96px] overflow-auto rounded-xl border border-line bg-surface p-[5px] shadow-[0_14px_32px_-10px_rgba(23,31,40,0.22),0_2px_6px_rgba(23,31,40,0.06)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`uc-opt ${isSelected ? "on" : ""} flex w-full items-center justify-between gap-2.5 rounded-lg px-[10px] py-2 text-[13px] whitespace-nowrap transition-[background] duration-100 ${isSelected ? "bg-blue-t font-bold text-blue-d" : "font-semibold text-t2 hover:bg-bg"}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  aria-hidden="true"
                  className={`h-[14px] w-[14px] flex-none ${isSelected ? "opacity-100" : "opacity-0"}`}
                >
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
