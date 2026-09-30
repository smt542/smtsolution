"use client";

import { useEffect, useState } from "react";

import { meterClasses as styles } from "./meterClasses";

type MeterMonthSheetProps = {
  /** 지금 보고 있는 달 "YYYY-MM". */
  value: string;
  /** 고를 수 있는 달인지(정본 `OPEN`). */
  isOpenMonth: (year: number, month: number) => boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

function Chevron({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** 정본 년월 선택 바텀시트(`#mmScrim`). 회색 달은 고를 수 없다. */
export function MeterMonthSheet({ value, isOpenMonth, onSelect, onClose }: MeterMonthSheetProps) {
  const [year, month] = value.split("-").map(Number);
  const [pickYear, setPickYear] = useState(year);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const yearHasOpenMonth = (y: number) => Array.from({ length: 12 }, (_, i) => isOpenMonth(y, i + 1)).some(Boolean);

  const yearNav = (step: -1 | 1) => {
    const enabled = yearHasOpenMonth(pickYear + step);
    return (
      <button
        type="button"
        className={enabled ? styles.sheetNav : styles.sheetNavOff}
        aria-label={step < 0 ? "이전 연도" : "다음 연도"}
        aria-disabled={!enabled}
        onClick={() => enabled && setPickYear(pickYear + step)}
      >
        <Chevron d={step < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </button>
    );
  };

  return (
    <div className={styles.sheet} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className={styles.sheetBody} role="dialog" aria-modal="true" aria-label="년월 선택">
        <div className={styles.sheetGrab} />
        <div className={styles.sheetTitle}>년월 선택</div>
        <div className={styles.sheetHead}>
          {yearNav(-1)}
          <b className={styles.sheetYear}>{pickYear}</b>
          {yearNav(1)}
        </div>
        <div className={styles.sheetGrid}>
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const open = isOpenMonth(pickYear, m);
            const selected = pickYear === year && m === month;
            return (
              <button
                key={m}
                type="button"
                className={selected ? styles.sheetCellOn : open ? styles.sheetCell : styles.sheetCellOff}
                disabled={!open}
                aria-pressed={selected}
                onClick={() => onSelect(`${pickYear}-${pad(m)}`)}
              >
                {m}월
              </button>
            );
          })}
        </div>
        <div className={styles.sheetNote}>
          <i className={styles.sheetNoteSwatch} />
          회색 월은 아직 자료가 생성되지 않았어요
        </div>
      </div>
    </div>
  );
}
