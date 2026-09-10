"use client";
import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

/** Figma collapsible row: chevron-right (collapsed) + bold title; body px-16 pb-16 pt-14. */
export function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-[8px] rounded-[12px] border border-line bg-surface">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex w-full items-center gap-[10px] rounded-[12px] px-[16px] py-[13px] text-left leading-[normal] hover:bg-[#fbfcfd] ${
            open ? "rounded-b-none border-b border-line2" : ""
          }`}
        >
          <ChevronDownIcon
            variant="building-register-field"
            className={`size-[16px] shrink-0 text-t3 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="text-[14px] font-bold leading-[normal] text-t1">{title}</span>
        </button>
        <div className={open ? "px-[16px] pb-[16px] pt-[14px]" : "hidden"}>{children}</div>
    </div>
  );
}
