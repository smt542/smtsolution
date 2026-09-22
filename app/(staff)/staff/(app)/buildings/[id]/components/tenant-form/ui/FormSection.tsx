"use client";
import React, { useState } from "react";

/**
 * 번호가 매겨진 접이식 섹션 카드 (Figma 673-58897).
 * 헤더: 청록 순번 배지 + 섹션명 + 접기 chevron(펼침 ∨ / 접힘 >). 본문: p-[17px].
 *
 * 펼침·접힘은 grid-template-rows 를 0fr↔1fr 로 보간해 높이를 부드럽게 전환한다.
 * (height:auto 는 전환되지 않으므로 max-height 추정 없이 쓸 수 있는 유일한 방법)
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
  // 높이를 깎으려면 본문을 클립해야 하지만(grid item 의 min-height:auto 해제), 다 열린 뒤에도
  // 클립이 남아 있으면 SelectField·DateField 팝오버가 섹션 경계에서 잘린다. 그래서 전환 중에만 클립한다.
  const [clip, setClip] = useState(!defaultOpen);
  return (
    <section className="rounded-[14px] border border-line bg-white shadow-[0px_1px_3px_rgba(23,31,40,0.04)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setClip(true);
          setOpen((v) => !v);
        }}
        className="flex w-full items-center gap-[8px] rounded-t-[14px] bg-[#fbfcfd] px-[18px] py-[12px] text-left"
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
          className={`h-[18px] w-[18px] shrink-0 text-t3 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
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
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        onTransitionEnd={(e) => {
          // 본문 안쪽 컨트롤의 transitionend 도 버블링되므로 이 엘리먼트의 행 높이 전환만 받는다.
          if (e.target === e.currentTarget && e.propertyName === "grid-template-rows") setClip(!open);
        }}
      >
        {/* 헤더 구분선을 본문 위쪽에 두면 접혔을 때 클립돼 사라진다(섹션 하단 테두리와 겹치지 않음). */}
        <div className={clip ? "overflow-hidden" : ""} inert={!open}>
          <div className={`border-t border-line ${bodyPadded ? "p-[17px]" : ""}`}>{children}</div>
        </div>
      </div>
    </section>
  );
}
