"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DpCalendar, parseDpDate, type DpCalendarView } from "@/components/common/DpCalendar";
import { PARTNER_FIELD_TRIGGER, type PartnerFieldLook } from "./partnerFieldTrigger";

type PartnerDateSheetProps = {
  id?: string;
  value: string; // "YYYY-MM-DD" | ""
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  look?: PartnerFieldLook;
};

const viewOf = (value: string): DpCalendarView => {
  const parsed = value ? parseDpDate(value) : null;
  if (parsed) return { y: parsed[0], m: parsed[1] - 1 };
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() };
};

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-4 flex-none text-t3">
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
    </svg>
  );
}

/**
 * 현장 앱 날짜 선택 — 정본 `.dd-btn` 트리거 + `.cal` 바텀시트(mobile-as·mobile-as-new·mobile-ms-new 공통).
 * 트리거를 누르면 화면 아래에 달력 시트가 뜨고, 날짜를 누르면 값을 바꾸고 닫힌다. 어두운 바깥·Esc도 닫는다.
 * 정본 날짜 트리거는 `.dd`로 감싸지 않아 시트가 열려도 청록 테두리가 없다. 빈 값은 글자색만 t4(굵기는 트리거 그대로).
 * 값은 "YYYY-MM-DD"로 주고받고 표시는 정본대로 "YYYY.MM.DD". 달력 본체는 공용 DpCalendar(look `bottomSheet`)다.
 * 시트는 body 포탈(z 90 = 정본 `.cal`), Esc는 Dp 피커 규약(window 캡처 + 전파 중단)이다.
 */
export function PartnerDateSheet({
  id,
  value,
  onChange,
  ariaLabel,
  placeholder = "날짜 선택",
  disabled = false,
  look = "as",
}: PartnerDateSheetProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DpCalendarView>(() => viewOf(value));

  useEffect(() => {
    if (!open) return;
    sheetRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [open]);

  // 열 때 선택 값의 달(없으면 이번 달)로 맞춘다 — 정본 openCal
  const openSheet = () => {
    setView(viewOf(value));
    setOpen(true);
  };
  const pick = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={openSheet}
        className={`${PARTNER_FIELD_TRIGGER[look]} border-line`}
      >
        <span className={value ? "min-w-0 truncate" : "min-w-0 truncate text-t4"}>
          {value ? value.replaceAll("-", ".") : placeholder}
        </span>
        <CalendarGlyph />
      </button>

      {open && !disabled
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-end justify-center bg-scrim antialiased"
              onClick={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                ref={sheetRef}
                role="dialog"
                aria-modal="true"
                aria-label={`${ariaLabel} 달력`}
                tabIndex={-1}
                className="w-full max-w-[440px] rounded-t-[22px] bg-white px-[18px] pb-[26px] pt-[18px] leading-[normal] text-t1 outline-none"
              >
                <DpCalendar look="bottomSheet" view={view} onViewChange={setView} value={value} onPick={pick} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
