"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { CustomDropdown, type DropdownOption } from "@/components/common";
import { ZoomInIcon, ZoomOutIcon } from "@/components/icons";

interface FilterDropdownProps {
  ariaLabel: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** 정본 인라인 메뉴 최소 폭(연도 104·월분 112·그룹 118). */
  menuMinWidth?: number;
  /** 버튼 최소 폭(px). 주지 않으면 정본처럼 글자 폭대로 둔다(자동이체 세대 출력 모달만 Figma 폭을 하한으로 준다). */
  width?: number;
}

// 정본 `.lg-srch .uc-dd`: 메뉴 왼쪽 정렬·패딩 5·옵션 간격 10·옵션 hover #F5F7F9·버튼 hover 테두리만.
// 화살표 회전·청록과 메뉴 페이드는 CustomDropdown chevron="accent"·menuTransition 이 맡는다(검침대장 모달과 같은 정본 규칙).
const FILTER_DROPDOWN = [
  "[&_.uc-dd-lbl]:whitespace-nowrap",
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:border-[#C9D0D8]",
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:shadow-none",
  "[&_.uc-dd-menu]:left-0",
  "[&_.uc-dd-menu]:right-auto",
  "[&_.uc-dd-menu]:p-[5px]",
  "[&_.uc-opt]:gap-[10px]",
  "[&_.uc-opt:not(.on):hover]:bg-[#F5F7F9]",
].join(" ");

/** 출력 모달 상단 필터용 드롭다운. 정본은 선택 항목에 체크표시를 보여주므로 기본 variant("menu")를 쓴다. */
export function FilterDropdown({ ariaLabel, value, options, onChange, menuMinWidth, width }: FilterDropdownProps) {
  return (
    <div
      style={width === undefined ? undefined : { minWidth: width }}
      className={`${FILTER_DROPDOWN}${width === undefined ? "" : " [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between"}`}
    >
      <CustomDropdown
        ariaLabel={ariaLabel}
        value={value}
        options={options}
        onChange={onChange}
        size="compact"
        menuMinWidth={menuMinWidth}
        chevron="accent"
        menuTransition
      />
    </div>
  );
}

interface SelectionCheckProps {
  checked: boolean;
  ariaLabel: string;
  onChange: () => void;
  disabled?: boolean;
}

/** 정본 `.lg-ck`: 17px·모서리 5·테두리 1.5px, 켜지면 청록 바탕에 흰 체크(stroke 3). */
export function SelectionCheck({ checked, ariaLabel, onChange, disabled = false }: SelectionCheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      className={`flex size-[17px] flex-none cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] disabled:cursor-not-allowed disabled:opacity-35 ${
        checked ? "border-blue bg-blue" : "border-line bg-white"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`size-[11px] text-white ${checked ? "opacity-100" : "opacity-0"}`}
      >
        <path d="M4 12.5l5 5L20 6.5" />
      </svg>
    </button>
  );
}

interface ModalActionButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  icon?: string;
  className?: string;
}

export function ModalActionButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  icon,
  className = "",
}: ModalActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[40px] items-center justify-center gap-[7px] rounded-[11px] px-[17px] text-[13.5px] font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        variant === "primary"
          ? "bg-[#14a497] text-white shadow-[0_7px_14px_-6px_rgba(20,164,151,0.5)] hover:bg-[#0f857a]"
          : "border border-[#e8ebee] bg-white text-[#4e5968] hover:bg-[#f8f9fa]"
      } ${className}`}
    >
      {icon && <Image aria-hidden="true" src={icon} alt="" width={16} height={16} className="size-[16px]" />}
      {children}
    </button>
  );
}

/** 정본 `setZoom`: 100% = 용지 폭을 미리보기 폭에 맞춘 배율, 25%씩 50~400%. */
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 400;
export const ZOOM_STEP = 25;

interface ZoomControlsProps {
  zoom: number;
  onZoom: (value: number) => void;
}

const ZOOM_BUTTON = "inline-flex h-6 w-[26px] items-center justify-center rounded-[6px] text-t2 hover:bg-bg hover:text-t1";

/** 정본 `.adj-zoom`: 미리보기 아래 가운데에 떠 있는 배율 조절(버튼 사이 구분선 없음). */
export function ZoomControls({ zoom, onZoom }: ZoomControlsProps) {
  return (
    <div className="absolute bottom-[14px] left-1/2 z-[3] inline-flex -translate-x-1/2 items-center gap-[2px] rounded-[10px] border border-line bg-white p-[3px] leading-[normal] shadow-[0_4px_14px_-4px_rgba(23,31,40,0.24)]">
      <button
        type="button"
        title="축소"
        aria-label="미리보기 축소"
        onClick={() => onZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
        className={ZOOM_BUTTON}
      >
        <ZoomOutIcon aria-hidden="true" className="size-[14px]" />
      </button>
      <span className="min-w-[38px] text-center text-[11px] font-bold tabular-nums text-t2">{zoom}%</span>
      <button
        type="button"
        title="확대"
        aria-label="미리보기 확대"
        onClick={() => onZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
        className={ZOOM_BUTTON}
      >
        <ZoomInIcon aria-hidden="true" className="size-[14px]" />
      </button>
    </div>
  );
}
