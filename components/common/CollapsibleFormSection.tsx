"use client";
import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ChevronDownIcon } from "@/components/icons";

/** 본문 위아래 여백(px) — 정본 `.hf-fsec-b{padding:17px}`. */
const BODY_PADDING_Y = 17;

/** Figma numbered section card: teal index badge + title + collapse chevron; body p-17.
 *  접고 펼칠 때 정본 building-detail `.hf-fsec-b` 전환(max-height·opacity·padding .18s ease)을 쓴다. */
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
  const bodyRef = useRef<HTMLDivElement>(null);

  // 정본 JS와 같은 순서: 펼칠 땐 목표 높이까지 늘린 뒤 제한을 풀고, 접을 땐 현재 높이를 시작값으로 고정한 다음 프레임에 0으로.
  const toggle = () => {
    const body = bodyRef.current;
    if (!body) return;
    body.style.overflow = "hidden";
    if (open) {
      body.style.maxHeight = `${body.scrollHeight}px`;
      body.getBoundingClientRect();
      requestAnimationFrame(() => {
        body.style.maxHeight = "0px";
        // 여백·투명도 클래스도 같은 프레임에 바뀌어야 세 전환이 함께 시작한다.
        flushSync(() => setOpen(false));
      });
    } else {
      // 접힌 상태는 위아래 여백이 0이라 scrollHeight = 내용 높이.
      body.style.maxHeight = `${body.scrollHeight + BODY_PADDING_Y * 2}px`;
      setOpen(true);
    }
  };

  return (
    <section className="mb-[13px] rounded-[14px] border border-line bg-surface shadow-[0_1px_3px_rgba(23,31,40,0.04)]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-[8px] bg-[#fbfcfd] px-[18px] py-[12px] text-left ${
          open ? "rounded-t-[14px] border-b border-line" : "rounded-[14px]"
        }`}
      >
        <span className="rounded-[7px] bg-[#e2f5f1] px-[9px] py-[3px] text-[12px] font-bold leading-[1.4] text-[#0e8677]">
          {index}
        </span>
        <span className="text-[14px] font-extrabold leading-[normal] text-t1">{title}</span>
        <ChevronDownIcon
          variant="building-register-section"
          className={`ml-auto size-[18px] text-t3 transition-transform duration-200 ease-[ease] ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <div
        ref={bodyRef}
        inert={!open}
        onTransitionEnd={(e) => {
          if (e.target !== e.currentTarget || e.propertyName !== "max-height") return;
          // 전환이 끝나면 인라인 값을 지워 클래스 상태(펼침=제한 없음·넘침 보임 / 접힘=0·숨김)로 돌아간다.
          e.currentTarget.style.maxHeight = "";
          e.currentTarget.style.overflow = "";
        }}
        className={`px-[17px] [transition:max-height_.18s_ease,opacity_.18s_ease,padding_.18s_ease] ${
          open ? "py-[17px] opacity-100" : "max-h-0 overflow-hidden py-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </section>
  );
}
