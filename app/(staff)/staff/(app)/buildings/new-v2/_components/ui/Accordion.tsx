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
    <div className="pt-[14px]">
      <div className="overflow-hidden rounded-[12px] border border-line bg-surface">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-[10px] px-[16px] py-[13px] text-left"
        >
          <ChevronDownIcon
            variant="building-register-field"
            className={`size-[16px] shrink-0 text-t3 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="text-[14px] font-bold text-t1">{title}</span>
        </button>
        <div className={open ? "px-[16px] pb-[16px] pt-[14px]" : "hidden"}>{children}</div>
      </div>
    </div>
  );
}
