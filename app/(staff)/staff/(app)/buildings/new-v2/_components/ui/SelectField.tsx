"use client";
import { useEffect, useRef, useState } from "react";
import { FieldLabel } from "./FieldLabel";
import { ChevronDownIcon } from "@/components/icons";

/** 문자열이면 값=글자. 글자가 겹칠 수 있으면(같은 이름의 협력업체) 값을 따로 준다. */
export type SelectOption = string | { value: string; label: string };
const optionValue = (option: SelectOption) => (typeof option === "string" ? option : option.value);
const optionLabel = (option: SelectOption) => (typeof option === "string" ? option : option.label);

/** Figma dropdown: h-42 rounded-10 box + 16px chevron; lightweight popover (preview). */
export function SelectField({
  label,
  required,
  hint,
  placeholder = "선택",
  value,
  onChange,
  options,
  full,
  variant = "default",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  options: SelectOption[];
  full?: boolean;
  variant?: "default" | "staff";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => optionValue(option) === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const staff = variant === "staff";
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <FieldLabel required={required} hint={hint}>
        {label}
      </FieldLabel>
      <div ref={rootRef} className="relative pt-[6px]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex w-full items-center justify-between border border-line bg-surface text-left outline-none focus:border-teal focus:shadow-[0_0_0_3px_var(--color-teal-t)] ${
            staff
              ? "h-[40px] rounded-[11px] px-[12px] text-[14px]"
              : "h-[42px] rounded-[10px] px-[13px] text-[13.5px]"
          }`}
        >
          <span className={`font-semibold leading-[normal] ${value ? "text-t1" : "font-medium text-t4"}`}>
            {selected ? optionLabel(selected) : value || placeholder}
          </span>
          <ChevronDownIcon
            variant="building-register-field"
            className={`${staff ? "size-[15px]" : "size-[16px]"} shrink-0 text-t3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+5px)] z-[90] max-h-[240px] overflow-auto rounded-[12px] border border-line bg-surface p-[6px] shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)]"
          >
            {options.map((option) => {
              const o = optionValue(option);
              return (
                <button
                  key={o}
                  type="button"
                  role="option"
                  aria-selected={o === value}
                  onClick={() => {
                    onChange?.(o);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-[8px] px-[11px] py-[9px] text-left text-[13.5px] font-semibold leading-[normal] ${
                    staff ? "rounded-[9px]" : "rounded-[8px]"
                  } ${
                    o === value
                      ? staff
                        ? "bg-blue-t2 font-bold text-teal-d"
                        : "bg-teal-t font-bold text-teal"
                      : "text-t2 hover:bg-bg"
                  }`}
                >
                  <span>{optionLabel(option)}</span>
                  {staff && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`size-[14px] shrink-0 ${o === value ? "opacity-100" : "opacity-0"}`}
                      aria-hidden="true"
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
    </div>
  );
}
