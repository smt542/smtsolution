"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { CustomDropdown, type DropdownOption } from "@/components/common";

interface FilterDropdownProps {
  ariaLabel: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Figma 실측 폭. 필터 열 리듬을 지키되, 라벨이 더 길면 줄바꿈 대신 늘어나도록 하한으로만 쓴다. */
  width: number;
}

/**
 * 출력 모달 상단 필터용 드롭다운. 공용 CustomDropdown을 쓰고 폭 하한만 Figma 값으로 맞춘다.
 * 정본이 선택 항목에 체크표시를 보여주므로 기본 variant("menu")를 그대로 쓴다 — field로 바꾸지 말 것.
 */
export function FilterDropdown({ ariaLabel, value, options, onChange, width }: FilterDropdownProps) {
  return (
    <div style={{ minWidth: width }} className="[&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between [&_.uc-dd-lbl]:whitespace-nowrap">
      <CustomDropdown ariaLabel={ariaLabel} value={value} options={options} onChange={onChange} size="compact" />
    </div>
  );
}

interface SelectionCheckProps {
  checked: boolean;
  ariaLabel: string;
  onChange: () => void;
  disabled?: boolean;
}

export function SelectionCheck({ checked, ariaLabel, onChange, disabled = false }: SelectionCheckProps) {
  const contents = checked && (
    <Image src="/figma-assets/bill/check.svg" alt="" width={11} height={11} className="size-[11px]" />
  );
  const className = `flex size-[17px] shrink-0 items-center justify-center rounded-[5px] border transition ${
    checked ? "border-[#14a497] bg-[#14a497]" : "border-[#d1d6db] bg-white"
  } disabled:cursor-not-allowed disabled:opacity-35`;

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
      className={className}
    >
      {contents}
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
      className={`flex h-[40px] items-center justify-center gap-[7px] rounded-[11px] px-[17px] text-[13.5px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45 ${
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

interface ZoomControlsProps {
  zoom: number;
  onZoom: (value: number) => void;
}

export function ZoomControls({ zoom, onZoom }: ZoomControlsProps) {
  return (
    <div className="absolute bottom-[14px] left-1/2 z-10 flex h-[32px] -translate-x-1/2 items-center overflow-hidden rounded-[9px] border border-[#dfe3e7] bg-white shadow-[0_4px_14px_rgba(23,31,40,0.12)]">
      <button
        type="button"
        aria-label="미리보기 축소"
        onClick={() => onZoom(Math.max(50, zoom - 10))}
        className="flex h-full w-[31px] items-center justify-center hover:bg-[#f2f4f6]"
      >
        <Image src="/figma-assets/bill/zoom-out.svg" alt="" width={14} height={14} />
      </button>
      <button
        type="button"
        aria-label="미리보기 배율 초기화"
        onClick={() => onZoom(100)}
        className="h-full w-[40px] border-x border-[#e8ebee] text-[10.5px] font-bold text-[#4e5968] hover:bg-[#f2f4f6]"
      >
        {zoom}%
      </button>
      <button
        type="button"
        aria-label="미리보기 확대"
        onClick={() => onZoom(Math.min(140, zoom + 10))}
        className="flex h-full w-[31px] items-center justify-center hover:bg-[#f2f4f6]"
      >
        <Image src="/figma-assets/bill/zoom-in.svg" alt="" width={14} height={14} />
      </button>
    </div>
  );
}
