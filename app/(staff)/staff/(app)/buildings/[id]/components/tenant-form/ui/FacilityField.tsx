"use client";
import React, { useState } from "react";
import type { Facility } from "@/hooks/reactquery/occupancies";

/**
 * 시설정보 — 정본 `staff/tenant-register/tenant-register.dc.html` 의 `.hf-fgrid`/`.hf-ck`.
 *
 * 정본 규격
 * - `.hf-fgrid`  grid, gap 13px 15px, `repeat(4,1fr)`
 * - `.hf-ck`     flex, gap 8px, 13.5px/600, `--t2`
 * - `.hf-ckb`    19x19, r6, 2px `--line`; on 이면 `--blue` 채움 + 5x9 흰 체크(45도)
 * - `.fac-rm`    `margin-left:5px`, 16px, line-height 1, `--t4`
 * - `.fac-add`   `.hf-ck` + `--blue`/700
 *
 * 정본 동작: `＋ 항목 추가` 를 누르면 그 자리에 90px 입력이 생기고, Enter·포커스 아웃으로
 * 확정한다. 비우고 나가면 항목 자체가 사라지고, 확정된 항목은 평문 라벨 + `×` 가 된다.
 * 새 항목은 체크 해제 상태로 시작한다.
 */
export function FacilityField({
  value,
  onChange,
}: {
  value: Facility[];
  onChange: (next: Facility[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const setAt = (i: number, patch: Partial<Facility>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const add = () => {
    onChange([...value, { label: "", on: false }]);
    setEditingIndex(value.length);
  };

  // 정본 commit: 비었으면 항목을 지우고, 아니면 평문 라벨로 굳힌다.
  const commit = (i: number) => {
    const label = (value[i]?.label ?? "").trim();
    if (label) setAt(i, { label });
    else removeAt(i);
    setEditingIndex(null);
  };

  return (
    <div className="grid grid-cols-2 gap-x-[15px] gap-y-[13px] md:grid-cols-4">
      {value.map((f, i) => (
        <span key={i} className="flex items-center gap-[8px] text-[13.5px] font-semibold text-t2">
          <button
            type="button"
            role="checkbox"
            aria-checked={f.on}
            aria-label={f.label || "시설 항목"}
            onClick={() => setAt(i, { on: !f.on })}
            className={`relative size-[19px] shrink-0 rounded-[6px] border-2 ${
              f.on ? "border-teal bg-teal" : "border-line bg-white"
            }`}
          >
            {f.on && (
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-[46%] h-[9px] w-[5px] -translate-x-1/2 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-white"
              />
            )}
          </button>
          {editingIndex === i ? (
            <input
              autoFocus /* 정본은 추가 즉시 입력에 포커스한다 */
              value={f.label}
              onChange={(e) => setAt(i, { label: e.target.value })}
              onBlur={() => commit(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              placeholder="새 항목"
              aria-label="시설 항목명"
              className="w-[90px] border-none bg-transparent text-[13.5px] font-semibold text-t1 outline-none placeholder:font-medium placeholder:text-t4"
            />
          ) : (
            <>
              <span>{f.label}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`${f.label || "시설 항목"} 삭제`}
                className="ml-[5px] text-[16px] leading-none text-t4 hover:text-red"
              >
                ×
              </button>
            </>
          )}
        </span>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-[8px] justify-self-start text-[13.5px] font-bold text-teal"
      >
        ＋ 항목 추가
      </button>
    </div>
  );
}
