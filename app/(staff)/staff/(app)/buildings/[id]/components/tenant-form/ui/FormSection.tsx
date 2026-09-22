"use client";
import React, { useState } from "react";

/**
 * 번호가 매겨진 접이식 섹션 카드 (Figma 673-58897).
 * 헤더: 청록 순번 배지 + 섹션명 + 접기 chevron. 본문: p-[17px].
 */
export function FormSection({
  index,
  title,
  children,
  defaultOpen = true,
  bodyPadded = true,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  bodyPadded?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-[14px] border border-line bg-white shadow-[0px_1px_3px_rgba(23,31,40,0.04)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-[8px] rounded-t-[14px] border-b border-line bg-[#fbfcfd] px-[18px] py-[12px] text-left"
      >
        <span className="flex items-center rounded-[7px] bg-[#e2f5f1] px-[9px] py-[3px] text-[12px] font-bold leading-[16.8px] text-[#0e8677]">
          {index}
        </span>
        <span className="text-[14px] font-extrabold text-t1">{title}</span>
        <span className="flex-1" />
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          className={`h-[18px] w-[18px] shrink-0 text-t3 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M4.5 6.75L9 11.25L13.5 6.75"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && <div className={bodyPadded ? "p-[17px]" : ""}>{children}</div>}
    </section>
  );
}
