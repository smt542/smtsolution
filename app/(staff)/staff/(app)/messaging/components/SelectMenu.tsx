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
 * 템플릿 등록·수정 모달 커스텀 드롭다운(정본 messaging.dc.html `.tf-dd`).
 * 열리면 청록 테두리 + 3px 링, 선택 항목은 blue-t2 바탕·blue-d 볼드 + 체크로 표시한다.
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
        className={`flex h-[42px] w-full items-center justify-between gap-[8px] rounded-[11px] border bg-white px-[12px] text-[14px] font-semibold leading-[normal] text-t1 outline-none ${
          open ? "border-blue shadow-[0_0_0_3px_var(--color-blue-t)]" : "border-line"
        }`}
      >
        <span>{selectedLabel}</span>
        <svg
          viewBox="0 0 24 24"
          className={`size-[15px] shrink-0 text-t3 transition-transform duration-150 ease-[ease] ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-[calc(100%+5px)] z-30 rounded-[12px] border border-line bg-white p-[6px] shadow-[0_14px_34px_-10px_rgba(23,31,40,0.26)]"
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
                  className={`flex w-full items-center justify-between gap-[8px] rounded-[9px] px-[11px] py-[9px] text-left text-[13.5px] leading-[normal] ${
                    isSelected
                      ? "bg-blue-t2 font-bold text-blue-d"
                      : "font-semibold text-t2 hover:bg-bg"
                  }`}
                >
                  <span>{option.label}</span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`size-[14px] shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
