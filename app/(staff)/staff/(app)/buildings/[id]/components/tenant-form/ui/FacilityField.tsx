"use client";
import React from "react";
import type { Facility } from "@/hooks/reactquery/occupancies";

/**
 * 시설정보: 4열 그리드(정본 98:10589 — 387.75px×4, gap 15/13) + ＋항목 추가.
 *
 * 정본에는 빈 상태만 있어 항목 행은 정본 근거가 없다. 행 높이는 `＋ 항목 추가`
 * 행(16px)에 맞춰 그리드가 고르게 떨어지도록 하고, 삭제(×)는 라벨 바로 뒤에 붙인다.
 * 라벨 입력은 내용 폭만큼만 차지한다 — 폭을 잡아 주는 숨은 span 위에 입력을 겹친다.
 */
export function FacilityField({
  value,
  onChange,
}: {
  value: Facility[];
  onChange: (next: Facility[]) => void;
}) {
  const setAt = (i: number, patch: Partial<Facility>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { label: "", on: true }]);

  return (
    <div className="grid grid-cols-2 gap-x-[15px] gap-y-[13px] md:grid-cols-4">
      {value.map((f, i) => (
        <div key={i} className="flex h-[16px] items-center gap-[6px] justify-self-start">
          <button
            type="button"
            role="checkbox"
            aria-checked={f.on}
            aria-label={f.label || "시설 항목"}
            onClick={() => setAt(i, { on: !f.on })}
            className={`flex size-[16px] shrink-0 items-center justify-center rounded-[5px] border-2 ${
              f.on ? "border-teal bg-teal" : "border-line bg-white"
            }`}
          >
            {f.on && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-[10px]"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            )}
          </button>
          {/* 숨은 span 이 폭을 잡고 입력이 그 위에 겹친다 — 라벨 길이만큼만 차지하게 한다. */}
          <span className="inline-grid min-w-0 max-w-[240px] items-center">
            <span
              aria-hidden="true"
              className="invisible col-start-1 row-start-1 min-w-[56px] whitespace-pre text-[13.5px] font-semibold"
            >
              {f.label || "새 항목"}
            </span>
            <input
              value={f.label}
              onChange={(e) => setAt(i, { label: e.target.value })}
              placeholder="새 항목"
              aria-label="시설 항목명"
              className="col-start-1 row-start-1 w-full border-b border-line bg-transparent text-[13.5px] font-semibold leading-[16px] text-t2 outline-none placeholder:font-medium placeholder:text-t4 focus:border-teal"
            />
          </span>
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label={`${f.label || "시설 항목"} 삭제`}
            className="flex size-[16px] shrink-0 items-center justify-center text-[14px] leading-none text-t4 hover:text-red"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="h-[16px] justify-self-start text-[13.5px] font-bold leading-[16px] text-teal"
      >
        ＋ 항목 추가
      </button>
    </div>
  );
}
