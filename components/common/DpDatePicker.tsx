"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 원본 프로토타입 `.dp`(uc-dpx) 커스텀 날짜 선택기. 네이티브 <input type="date">의 브라우저
 * 기본 달력 대신 원본과 동일한 팝업 달력을 띄운다. 값은 앱 배선과 동일하게 "YYYY-MM-DD"를 주고받되
 * 컨트롤 표시는 원본대로 점 구분("YYYY.MM.DD")으로 한다. 팝업은 원본 uc-dpx처럼 fixed 포탈로 띄워
 * 스크롤 컨테이너 클리핑을 피한다.
 */
interface DpDatePickerProps {
  value: string; // "YYYY-MM-DD" | ""
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const toDisplay = (value: string) => (value ? value.replaceAll("-", ".") : "");

export function DpDatePicker({
  value,
  onChange,
  placeholder = "날짜",
  disabled = false,
  ariaLabel,
}: DpDatePickerProps) {
  const ctlRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [view, setView] = useState(() => {
    if (value) {
      const [year, month] = value.split("-").map(Number);
      return { y: year, m: month - 1 };
    }
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  // 열릴 때 컨트롤 위치 기준으로 팝업 배치(원본 place() 이식) + 스크롤/리사이즈 추종
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const ctl = ctlRef.current;
      if (!ctl) return;
      const rect = ctl.getBoundingClientRect();
      const h = popRef.current?.offsetHeight || 300;
      const w = popRef.current?.offsetWidth || 262;
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

  // 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ctlRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = value ? value.split("-").map(Number) : null; // [y, m(1-based), d]
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  // 팝업을 열 때 선택된 값의 달로 이동(effect 대신 열기 시점에 동기화 → 캐스케이드 렌더 회피)
  const openPicker = () => {
    if (value) {
      const [year, month] = value.split("-").map(Number);
      setView({ y: year, m: month - 1 });
    }
    setOpen(true);
  };
  const pick = (day: number) => {
    onChange(`${view.y}-${pad(view.m + 1)}-${pad(day)}`);
    setOpen(false);
  };
  const shiftMonth = (delta: number) =>
    setView((current) => {
      const next = current.m + delta;
      return { y: current.y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 };
    });

  return (
    <div className="relative inline-flex">
      <button
        ref={ctlRef}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={`flex h-[28px] min-w-[106px] items-center justify-center gap-1.5 rounded-[8px] border px-[10px] text-[12px] font-medium outline-none ${
          disabled ? "cursor-default border-line2 bg-bg" : "cursor-pointer border-line bg-white"
        } ${open ? "border-blue shadow-[0_0_0_3px_var(--color-blue-t)]" : ""} ${value ? "text-t1" : "text-t4"}`}
      >
        {value ? toDisplay(value) : placeholder}
      </button>

      {open && !disabled && pos
        && createPortal(
          <div
            ref={popRef}
            className="fixed z-[200] w-[262px] rounded-[14px] border border-line bg-white p-[14px] shadow-[0_16px_40px_-12px_rgba(23,31,40,0.28)]"
            style={{ left: pos.left, top: pos.top }}
          >
            <div className="mb-[10px] flex items-center justify-between">
              <button type="button" aria-label="이전 달" onClick={() => shiftMonth(-1)} className="grid size-[30px] place-items-center rounded-[8px] text-[17px] text-t2 hover:bg-bg">‹</button>
              <span className="text-[14px] font-extrabold text-t1">{view.y}년 {view.m + 1}월</span>
              <button type="button" aria-label="다음 달" onClick={() => shiftMonth(1)} className="grid size-[30px] place-items-center rounded-[8px] text-[17px] text-t2 hover:bg-bg">›</button>
            </div>
            <div className="mb-[4px] grid grid-cols-7">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="py-[4px] text-center text-[11px] font-bold text-t4">{weekday}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-[2px]">
              {cells.map((day, index) =>
                day === null ? (
                  <span key={`empty-${index}`} className="h-[32px]" />
                ) : (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pick(day)}
                    className={`grid h-[32px] place-items-center rounded-[8px] text-[13px] font-semibold ${
                      selected && selected[0] === view.y && selected[1] === view.m + 1 && selected[2] === day
                        ? "bg-blue font-bold text-white"
                        : "text-t1 hover:bg-blue-t2"
                    }`}
                  >
                    {day}
                  </button>
                ),
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
