"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DpMonthPickerProps {
  id?: string;
  value: string; // "YYYY-MM" | ""
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minMonth?: string;
  maxMonth?: string;
  ariaLabel?: string;
  triggerClassName?: string;
  triggerOpenClassName?: string;
  endAdornment?: ReactNode;
  /** 루트 래퍼(relative inline-flex)에 덧붙이는 클래스 */
  className?: string;
}

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const pad = (n: number) => String(n).padStart(2, "0");
const toDisplay = (value: string) => (value ? value.replaceAll("-", ".") : "");

export function DpMonthPicker({
  id,
  value,
  onChange,
  placeholder = "월",
  disabled = false,
  minMonth,
  maxMonth,
  ariaLabel,
  triggerClassName,
  triggerOpenClassName,
  endAdornment,
  className,
}: DpMonthPickerProps) {
  const minimumMonth = minMonth || undefined;
  const maximumMonth = maxMonth || undefined;
  const ctlRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [year, setYear] = useState(() => {
    if (value) return parseInt(value.slice(0, 4), 10);
    return new Date().getFullYear();
  });

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const ctl = ctlRef.current;
      if (!ctl) return;
      const rect = ctl.getBoundingClientRect();
      // 실제 팝업 높이: p-[10px]×2 + header(26px) + mt-[8px] + grid(3×32+2×4) = 158px
      const h = popRef.current?.offsetHeight || 158;
      const w = popRef.current?.offsetWidth || 210;
      const below = window.innerHeight - rect.bottom - 10;
      setPos({
        left: Math.max(10, Math.min(rect.left, window.innerWidth - w - 10)),
        top: below >= h ? rect.bottom + 5 : Math.max(10, rect.top - h - 5),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // 바깥 탭·Esc 닫기 — pointerdown·window 캡처 Esc는 DpDatePicker와 같은 이유
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ctlRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      ctlRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onEscape, true);
    };
  }, [open]);

  const openPicker = () => {
    if (value) setYear(parseInt(value.slice(0, 4), 10));
    setOpen(true);
  };

  const pick = (month: number) => {
    const nextValue = `${year}-${pad(month)}`;
    if (minimumMonth && nextValue < minimumMonth) return;
    if (maximumMonth && nextValue > maximumMonth) return;
    onChange(nextValue);
    setOpen(false);
  };

  const minimumYear = minimumMonth ? parseInt(minimumMonth.slice(0, 4), 10) : null;
  const maximumYear = maximumMonth ? parseInt(maximumMonth.slice(0, 4), 10) : null;
  const previousYearDisabled = minimumYear !== null && year <= minimumYear;
  const nextYearDisabled = maximumYear !== null && year >= maximumYear;
  const selectedYear = value ? parseInt(value.slice(0, 4), 10) : null;
  const selectedMonth = value ? parseInt(value.slice(5, 7), 10) : null;

  return (
    <div className={`relative inline-flex${className ? ` ${className}` : ""}`}>
      <button
        ref={ctlRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={
          triggerClassName
            ? `${triggerClassName} ${open ? (triggerOpenClassName ?? "") : ""}`
            : `flex h-[28px] min-w-[106px] items-center justify-center gap-1.5 rounded-[8px] border px-[10px] text-[12px] font-medium outline-none ${
                disabled ? "cursor-default border-line2 bg-bg" : "cursor-pointer border-line bg-white"
              } ${open ? "border-teal" : ""} ${value ? "text-t1" : "text-t4"}`
        }
      >
        <span className={triggerClassName && !value ? "text-t4" : ""}>
          {value ? toDisplay(value) : placeholder}
        </span>
        {endAdornment}
      </button>

      {open && !disabled && pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={`${year}년 월 선택`}
            className="fixed z-[1000] flex w-[210px] flex-col items-start rounded-[12px] border border-[#e8ebee] bg-white p-[10px] drop-shadow-[0px_14px_17px_rgba(23,31,40,0.28)]"
            style={{ left: pos.left, top: pos.top }}
          >
            {/* 헤더: 이전/다음 연도 + 연도 표시 */}
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                aria-label="이전 년도"
                disabled={previousYearDisabled}
                onClick={() => setYear((y) => y - 1)}
                className="flex size-[26px] items-center justify-center rounded-[8px] hover:bg-bg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="text-[16px] leading-[normal] whitespace-nowrap text-[#8b95a1]">‹</span>
              </button>
              <span className="text-[13px] font-extrabold leading-[normal] whitespace-nowrap text-[#191f28]">
                {year}년
              </span>
              <button
                type="button"
                aria-label="다음 년도"
                disabled={nextYearDisabled}
                onClick={() => setYear((y) => y + 1)}
                className="flex size-[26px] items-center justify-center rounded-[8px] hover:bg-bg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="text-[16px] leading-[normal] whitespace-nowrap text-[#8b95a1]">›</span>
              </button>
            </div>
            {/* 월 그리드: 4열×3행 고정 */}
            <div className="mt-[8px] grid w-full grid-cols-[44.5px_44.5px_44.5px_44.5px] grid-rows-[32px_32px_32px] gap-[4px]">
              {MONTHS.map((label, idx) => {
                const m = idx + 1;
                const monthValue = `${year}-${pad(m)}`;
                const monthDisabled = Boolean(
                  (minimumMonth && monthValue < minimumMonth)
                  || (maximumMonth && monthValue > maximumMonth),
                );
                const isSelected = selectedYear === year && selectedMonth === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={monthDisabled}
                    onClick={() => pick(m)}
                    className={`flex h-[32px] items-center justify-center rounded-[8px] ${
                      monthDisabled
                        ? "cursor-default font-semibold text-t4 opacity-45"
                        : isSelected
                        ? "bg-teal font-bold text-white"
                        : "font-semibold text-[#4e5968] hover:bg-bg"
                    }`}
                  >
                    <span className="text-[12.5px] leading-[normal] whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
