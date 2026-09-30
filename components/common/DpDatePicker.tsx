"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DpCalendar, parseDpDate as parseDate } from "./DpCalendar";

/**
 * 원본 프로토타입 `.dp`(uc-dpx) 커스텀 날짜 선택기. 네이티브 <input type="date">의 브라우저
 * 기본 달력 대신 원본과 동일한 팝업 달력을 띄운다. 값은 앱 배선과 동일하게 "YYYY-MM-DD"를 주고받되
 * 컨트롤 표시는 원본대로 점 구분("YYYY.MM.DD")으로 한다. 팝업은 원본 uc-dpx처럼 fixed 포탈로 띄워
 * 스크롤 컨테이너 클리핑을 피한다. z-index는 CustomDropdown fixed 메뉴와 같은 1000 — 모달(최대 z-[600])
 * 안에서 열어도 그 위에 뜨고 토스트(2000)보다는 아래다(DpMonthPicker·DpTimePicker 동일).
 */
interface DpDatePickerProps {
  id?: string;
  value: string; // "YYYY-MM-DD" | ""
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  ariaLabel?: string;
  /** 폼 검증 에러 문구 연결용(트리거 버튼의 aria-describedby). button 역할은 aria-invalid를 지원하지 않는다 */
  ariaDescribedBy?: string;
  triggerClassName?: string;
  triggerOpenClassName?: string;
  /** 컨트롤 왼쪽(값 앞)에 놓는 장식. 원본 `.dp-ctl`의 선행 달력 아이콘에 대응한다 */
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  /** 루트 래퍼(relative inline-flex)에 덧붙이는 클래스. grid/flex 셀에서 폭 제어(w-full 등)에 사용 */
  className?: string;
  /** 선택된 값의 표시 포맷을 재정의한다. 기본값: "YYYY-MM-DD" → "YYYY.MM.DD" */
  displayFormatter?: (value: string) => string;
}

const toDisplay = (value: string) => (value ? value.replaceAll("-", ".") : "");

export function DpDatePicker({
  id,
  value,
  onChange,
  placeholder = "날짜",
  disabled = false,
  minDate,
  maxDate,
  ariaLabel,
  ariaDescribedBy,
  triggerClassName,
  triggerOpenClassName,
  startAdornment,
  endAdornment,
  className,
  displayFormatter,
}: DpDatePickerProps) {
  const minimumDate = minDate || undefined;
  const maximumDate = maxDate || undefined;
  const ctlRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [view, setView] = useState(() => {
    const parsed = parseDate(value);
    if (parsed) return { y: parsed[0], m: parsed[1] - 1 };
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

  // 바깥 클릭·Esc 닫기. iOS Safari는 버튼이 아닌 곳을 탭하면 mousedown을 보내지 않아 pointerdown을 쓴다.
  // Esc는 window 캡처 단계에서 먼저 받아 전파를 멈춘다 — document에서 Esc를 받는 모달·시트가 함께 닫히지 않게
  useEffect(() => {
    if (!open) return;
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

  // 팝업을 열 때 선택된 값의 달로 이동(effect 대신 열기 시점에 동기화 → 캐스케이드 렌더 회피)
  const openPicker = () => {
    const parsed = parseDate(value);
    if (parsed) setView({ y: parsed[0], m: parsed[1] - 1 });
    setOpen(true);
  };
  const pick = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div className={`relative inline-flex${className ? ` ${className}` : ""}`}>
      <button
        ref={ctlRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={triggerClassName
          ? `${triggerClassName} ${open ? triggerOpenClassName ?? "" : ""}`
          : `flex h-[28px] min-w-[106px] items-center justify-center gap-1.5 rounded-[8px] border px-[10px] text-[12px] font-medium outline-none ${
            disabled ? "cursor-default border-line2 bg-bg" : "cursor-pointer border-line bg-white"
          } ${open ? "border-blue shadow-[0_0_0_3px_var(--color-blue-t)]" : ""} ${value ? "text-t1" : "text-t4"}`}
      >
        {startAdornment}
        {/* 원본 `.dp-val.ph{color:var(--t4);font-weight:500}` */}
        <span className={triggerClassName && !value ? "font-medium text-t4" : ""}>
          {value ? (displayFormatter ? displayFormatter(value) : toDisplay(value)) : placeholder}
        </span>
        {endAdornment}
      </button>

      {open && !disabled && pos
        && createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={`${view.y}년 ${view.m + 1}월 달력`}
            className="fixed z-[1000] w-[262px] rounded-[14px] border border-line bg-white p-[14px] shadow-[0_16px_40px_-12px_rgba(23,31,40,0.28)]"
            style={{ left: pos.left, top: pos.top }}
          >
            <DpCalendar
              view={view}
              onViewChange={setView}
              value={value}
              onPick={pick}
              minDate={minimumDate}
              maxDate={maximumDate}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
