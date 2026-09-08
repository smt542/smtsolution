"use client";
import { useState } from "react";
import { FieldLabel } from "./FieldLabel";
import { ChevronDownIcon } from "@/components/icons";

/** Figma dropdown: h-42 rounded-10 box + 16px chevron; lightweight popover (preview). options = string[]. */
export function SelectField({
  label,
  required,
  hint,
  placeholder = "선택",
  value,
  onChange,
  options,
  full,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  options: string[];
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <FieldLabel required={required} hint={hint}>
        {label}
      </FieldLabel>
      <div className="relative pt-[6px]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-[42px] w-full items-center justify-between rounded-[10px] border border-line bg-surface px-[13px] text-left focus:border-teal focus:outline-none"
        >
          <span className={`text-[14px] font-semibold ${value ? "text-t1" : "text-t4"}`}>
            {value || placeholder}
          </span>
          <ChevronDownIcon
            variant="building-register-field"
            className={`size-[16px] shrink-0 text-t3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-[240px] overflow-auto rounded-[10px] border border-line bg-surface p-[5px] shadow-pop">
              {options.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onChange?.(o);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center rounded-[8px] px-[10px] py-[8px] text-left text-[13px] font-semibold ${
                    o === value ? "bg-teal-t text-teal-d" : "text-t2 hover:bg-bg"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
