"use client";

import { useEffect, useId, useRef, useState } from "react";

import { PARTNER_FIELD_TRIGGER, type PartnerFieldLook } from "./partnerFieldTrigger";

export type PartnerDropdownOption = { value: string; label: string };

type PartnerDropdownProps = {
  id?: string;
  ariaLabel: string;
  value: string;
  options: PartnerDropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** 값이 어떤 옵션과도 맞지 않을 때 트리거에 보일 문구(글자색 t4). 메뉴 항목으로는 나오지 않는다. */
  placeholder?: string;
  look?: PartnerFieldLook;
};

// 정본 `.dd-menu`·`.opt` — look마다 다른 속성은 한 벌씩 둔다(같은 속성 유틸 두 개를 이어 붙이지 않는다).
const MENU: Record<PartnerFieldLook, string> = {
  as: "max-h-[260px] rounded-[14px]",
  settlement: "max-h-[240px] rounded-[12px]",
};

const OPTION: Record<PartnerFieldLook, { on: string; off: string }> = {
  // mobile-as·mobile-as-new: 700, hover 없음
  as: { on: "bg-blue-t2 font-bold text-blue-d", off: "font-bold text-t2" },
  // mobile-ms-new: 600 + hover 회색, 선택은 700
  settlement: { on: "bg-blue-t2 font-bold text-blue-d", off: "font-semibold text-t2 hover:bg-bg" },
};

/**
 * 현장 앱 드롭다운 — 정본 `.dd`(mobile-as·mobile-as-new·mobile-ms-new). 네이티브 select 대신 쓴다.
 * 트리거를 누르면 바로 아래(6px)에 메뉴가 트리거 폭으로 열리고, 고르면 닫힌다. 열리면 트리거 테두리 청록 +
 * 3px 청록 링, 화살표 180°(.15s). 바깥 누르기(pointerdown — iOS Safari는 비버튼 탭에 mousedown을 안 보냄)·Esc로 닫힌다.
 * Esc는 Dp 피커 규약(window 캡처 + 전파 중단) — document에서 Esc를 받는 확인창이 같이 닫히지 않게.
 */
export function PartnerDropdown({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
  look = "as",
}: PartnerDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onEscape, true);
    };
  }, [open]);

  const trigger = `${PARTNER_FIELD_TRIGGER[look]} ${
    open ? "border-blue shadow-[0_0_0_3px_var(--color-blue-t)]" : "border-line"
  }`;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={trigger}
      >
        <span className={selected ? "min-w-0 truncate" : "min-w-0 truncate text-t4"}>
          {selected?.label ?? placeholder ?? ""}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
          className={`size-4 flex-none text-t3 transition-transform duration-150 ease-[ease] ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && !disabled ? (
        <div
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute inset-x-0 top-[calc(100%_+_6px)] z-40 overflow-auto border border-line bg-white p-1.5 shadow-[0_16px_36px_-12px_rgba(23,31,40,0.3)] ${MENU[look]}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-[11px] text-left text-[14.5px] leading-[normal] ${
                  isSelected ? OPTION[look].on : OPTION[look].off
                }`}
              >
                <span>{option.label}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  aria-hidden="true"
                  className={`size-[15px] flex-none ${isSelected ? "opacity-100" : "opacity-0"}`}
                >
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
