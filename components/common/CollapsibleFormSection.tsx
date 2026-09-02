"use client";
import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

/** Figma numbered section card: teal index badge + title + collapse chevron; body p-17. */
export function CollapsibleFormSection({
  index,
  title,
  defaultOpen = true,
  children,
}: {
  index: number;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-[14px] border border-line bg-surface shadow-[0px_1px_1.5px_rgba(23,31,40,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-[8px] bg-[#fbfcfd] px-[18px] py-[12px] text-left ${
          open ? "rounded-t-[14px] border-b border-line" : "rounded-[14px]"
        }`}
      >
        <span className="rounded-[7px] bg-[#e2f5f1] px-[9px] py-[3px] text-[12px] font-bold leading-[16px] text-[#0e8677]">
          {index}
        </span>
        <span className="text-[14px] font-extrabold text-t1">{title}</span>
        <ChevronDownIcon
          variant="building-register-section"
          className={`ml-auto size-[18px] text-t3 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <div className={open ? "p-[17px]" : "hidden"}>{children}</div>
    </section>
  );
}
