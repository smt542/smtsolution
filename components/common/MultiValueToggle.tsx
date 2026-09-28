"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

let closeActiveToggle: (() => void) | null = null;

export interface MultiValueToggleProps {
  items: string[];
  label: string;
}

export function MultiValueToggle({ items, label }: MultiValueToggleProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  useEffect(() => {
    if (!open) return;

    closeActiveToggle = close;
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };

    document.addEventListener("click", closeOutside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("click", closeOutside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", closeOnEscape, true);
      if (closeActiveToggle === close) closeActiveToggle = null;
    };
  }, [close, open]);

  const toggle = () => {
    if (open) {
      close();
      return;
    }

    closeActiveToggle?.();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 5, left: rect.left - 60 });
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex cursor-pointer border-0 bg-transparent p-0"
        aria-label={`${label} 전체 보기`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") event.stopPropagation();
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden="true"
          className="size-[13px] shrink-0 text-t3"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && position
        ? createPortal(
          <div
            className="fixed z-[150] whitespace-nowrap rounded-[10px] border border-line bg-surface p-[5px] leading-[normal] shadow-[0_12px_30px_-8px_rgba(23,31,40,.3)]"
            style={{ top: position.top, left: position.left }}
            onClick={(event) => {
              event.stopPropagation();
              close();
            }}
          >
            {items.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className={`px-[13px] py-[7px] text-[13px] font-semibold ${index === 0 ? "text-t1" : "text-t2"}`}
              >
                {item}
                {index === 0 ? <>{" "}<span className="font-medium text-t4">· 대표</span></> : null}
              </div>
            ))}
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
