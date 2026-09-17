"use client";

import Image from "next/image";
import type { ChangeEventHandler, ReactNode } from "react";

interface SmallSelectProps {
  ariaLabel: string;
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  children: ReactNode;
  className?: string;
}

export function SmallSelect({ ariaLabel, value, onChange, children, className = "" }: SmallSelectProps) {
  return (
    <span className={`relative block h-[32px] ${className}`}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        className="h-full w-full appearance-none rounded-[9px] border border-[#e8ebee] bg-white pl-[11px] pr-[31px] text-[13px] font-bold leading-none tracking-[-0.13px] text-[#191f28] outline-none transition focus:border-[#14a497] focus:ring-[3px] focus:ring-[#e2f5f1]"
      >
        {children}
      </select>
      <Image
        aria-hidden="true"
        src="/figma-assets/bill/select-chevron.svg"
        alt=""
        width={14}
        height={14}
        className="pointer-events-none absolute right-[10px] top-1/2 size-[14px] -translate-y-1/2"
      />
    </span>
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
