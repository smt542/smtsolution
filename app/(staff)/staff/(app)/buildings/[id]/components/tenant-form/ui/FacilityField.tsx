"use client";
import React from "react";
import type { Facility } from "@/hooks/reactquery/occupancies";

/** 원본 시설정보: 4열 체크박스 그리드(항목 on/off) + ＋항목 추가. */
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
        <div key={i} className="flex items-center gap-[8px]">
          <button
            type="button"
            role="checkbox"
            aria-checked={f.on}
            aria-label={f.label || "시설 항목"}
            onClick={() => setAt(i, { on: !f.on })}
            className={`flex size-[19px] shrink-0 items-center justify-center rounded-[6px] border-2 ${
              f.on ? "border-teal bg-teal" : "border-line bg-white"
            }`}
          >
            {f.on && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-[11px]"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            )}
          </button>
          <input
            value={f.label}
            onChange={(e) => setAt(i, { label: e.target.value })}
            placeholder="새 항목"
            className="min-w-0 flex-1 border-b border-transparent bg-transparent text-[13.5px] font-semibold text-t2 outline-none placeholder:font-medium placeholder:text-t4 focus:border-line"
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label="삭제"
            className="shrink-0 text-[16px] leading-none text-t4 hover:text-red"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-[6px] justify-self-start text-[13.5px] font-bold text-teal"
      >
        ＋ 항목 추가
      </button>
    </div>
  );
}
