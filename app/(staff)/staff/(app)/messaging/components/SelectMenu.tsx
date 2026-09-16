"use client";

import { useEffect, useRef, useState } from "react";

interface SelectMenuOption<T extends string> {
  value: T;
  label: string;
}

interface SelectMenuProps<T extends string> {
  value: T;
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * 템플릿 수정 모달 공용 커스텀 드롭다운(Figma 28-21455).
 * 열리면 테두리 청록, 선택 항목은 청록 볼드 + 체크로 표시한다.
 */
export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? "";

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-[42px] w-full items-center justify-between rounded-[11px] border bg-white px-[12px] text-[14px] font-semibold text-[#191f28] outline-none ${
          open ? "border-[#14a497]" : "border-[#e8ebee]"
        }`}
      >
        <span>{selectedLabel}</span>
        <svg
          viewBox="0 0 24 24"
          className={`size-[15px] shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="#8b95a1"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[11px] border border-[#e8ebee] bg-white py-[6px] shadow-[0px_10px_24px_rgba(23,31,40,0.12)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-[14px] py-[9px] text-left text-[14px] ${
                    isSelected
                      ? "bg-[#f0faf9] font-bold text-[#14a497]"
                      : "font-medium text-[#191f28] hover:bg-[#f7f8fa]"
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <svg
                      viewBox="0 0 24 24"
                      className="size-[16px] shrink-0"
                      fill="none"
                      stroke="#14a497"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
