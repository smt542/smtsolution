"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
  size?: "default" | "compact" | "notification";
  compact?: boolean;
  /**
   * "menu"(기본): 툴바/레일용. 메뉴가 내용 너비로 우측 정렬되고 선택 항목에 체크표시.
   * "field": 폼 필드용. 메뉴 너비를 버튼(트리거) 너비에 맞추고 체크표시를 숨긴다.
   */
  variant?: "menu" | "field";
  /**
   * "absolute"(기본): 트리거 기준 absolute 배치.
   * "fixed": 정본 `.rg-dd .ac-dd-menu{position:fixed;z-index:1000}`. 모달 본문처럼
   * `overflow:auto` 인 조상 안에 있을 때 필요하다 — absolute 로 두면 메뉴가 스크롤
   * 컨테이너를 늘려 모달에 스크롤바가 생기거나 `overflow:hidden` 에 잘린다.
   */
  position?: "absolute" | "fixed";
  /**
   * 값이 어떤 옵션과도 맞지 않을 때 버튼에 보일 미선택 라벨. 정본 `#ovYear`/`#ovMonth`
   * 처럼 초기 상태가 "년도"·"월" 인 드롭다운에 쓴다. 메뉴 항목으로는 나오지 않는다.
   * 주지 않으면 기존대로 첫 옵션 라벨로 대체한다.
   */
  placeholder?: string;
}

export function CustomDropdown({
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  size = "default",
  compact = false,
  variant = "menu",
  position = "absolute",
  placeholder,
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isFixed = position === "fixed";
  const matched = options.find((option) => option.value === value);
  const selected = matched ?? (placeholder === undefined ? options[0] : undefined);
  const isCompact = size === "compact" || compact;
  const isNotification = size === "notification";
  const isField = variant === "field";
  const triggerSize = isNotification
    ? "h-[34px] w-[64px] min-w-[64px] justify-between rounded-[9px] px-[10px] text-[13.5px] [&_svg]:h-[13px] [&_svg]:w-[13px]"
    : `${isCompact ? "h-8" : "h-9"} rounded-[9px] pr-[10px] pl-[11px] text-[13px] [&_svg]:h-[15px] [&_svg]:w-[15px]`;

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

  // 정본 `.rg-dd` 열기 좌표 계산을 그대로 옮겼다: 폭은 트리거에 맞추고, 아래로 펼쳤을 때
  // 뷰포트를 넘치면 트리거 위로 뒤집는다. 높이를 알아야 하므로 0,0 에 놓고 측정한 뒤 확정한다.
  useLayoutEffect(() => {
    if (!isFixed || !open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    menu.style.width = `${rect.width}px`;
    menu.style.left = "0px";
    menu.style.top = "0px";
    const height = menu.offsetHeight || 90;
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${
      rect.bottom + height + 8 > window.innerHeight
        ? Math.max(8, rect.top - height - 5)
        : rect.bottom + 5
    }px`;
  }, [isFixed, open]);

  // 프로토타입 공통 커스텀 드롭다운. 스타일은 Tailwind 유틸로 인라인화하되,
  // uc-dd/uc-dd-btn/uc-dd-menu/uc-opt 클래스명은 호출부의 [&_.uc-dd-btn]:… 오버라이드가
  // 계속 바인딩되도록 셀렉터 훅으로 유지한다(전역 CSS는 제거).
  return (
    <div
      ref={rootRef}
      className={`uc-dd ${isCompact ? "uc-dd--compact" : ""} ${isNotification ? "uc-dd--notification" : ""} ${open ? "open" : ""} relative flex-none`}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`uc-dd-btn inline-flex ${triggerSize} items-center gap-[7px] border ${open ? "border-blue" : "border-line"} bg-surface py-0 font-bold tracking-[-0.01em] text-t1 outline-none transition-[border-color,box-shadow] duration-[120ms] hover:border-blue hover:shadow-[0_0_0_3px_var(--color-blue-t)] disabled:cursor-default disabled:opacity-[.55] disabled:shadow-none ${open ? "shadow-[0_0_0_3px_var(--color-blue-t)]" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="uc-dd-lbl">{selected?.label ?? placeholder}</span>
        <ChevronDownIcon aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          className={`uc-dd-menu max-h-[236px] overflow-auto rounded-xl border border-line bg-surface p-[6px] shadow-[0_14px_32px_-10px_rgba(23,31,40,0.22),0_2px_6px_rgba(23,31,40,0.06)] ${
            isFixed
              ? "fixed z-[1000] min-w-[140px]"
              : `absolute top-[calc(100%_+_6px)] z-[80] ${isField ? "inset-x-0" : "right-0 min-w-[96px]"}`
          }`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                // 정본 `.ac-opt` 에는 line-height 선언이 없어 `normal`(≈1.2)이다.
                // 명시하지 않으면 Tailwind 기본 1.5가 걸려 옵션이 항목당 ~4px 부푼다.
                className={`uc-opt ${isSelected ? "on" : ""} flex w-full items-center ${isField ? "justify-start" : "justify-between"} gap-2 rounded-lg px-[10px] py-2 text-[13px] leading-[normal] whitespace-nowrap transition-[background] duration-100 ${isSelected ? "bg-blue-t font-bold text-blue-d" : "font-semibold text-t2 hover:bg-bg"}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {!isField && (
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
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
