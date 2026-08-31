"use client";
import React from "react";
import { TextField } from "./Fields";

/**
 * ＋추가로 값을 복수 입력하는 텍스트 필드 목록 (Figma: 전화번호/차량번호).
 * value: 전체 값 배열(첫 항목이 주값). 최소 1개 슬롯은 항상 노출.
 */
export function RepeatableTextField({
  values,
  onChange,
  placeholders,
  addLabel,
  type = "text",
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholders: string[];
  addLabel: string;
  type?: "text" | "number";
}) {
  const list = values.length > 0 ? values : [""];
  const setAt = (i: number, v: string) => {
    const next = [...list];
    next[i] = v;
    onChange(next);
  };
  const removeAt = (i: number) => {
    const next = list.filter((_, idx) => idx !== i);
    onChange(next.length > 0 ? next : [""]);
  };
  return (
    <div className="flex flex-col gap-[8px]">
      {list.map((v, i) => (
        <div key={i} className="flex items-center gap-[8px]">
          <TextField
            value={v}
            onChange={(nv) => setAt(i, nv)}
            placeholder={placeholders[i] ?? placeholders[placeholders.length - 1]}
            type={type}
          />
          {i > 0 && (
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="shrink-0 rounded-[8px] border border-line px-[10px] py-[8px] text-[13px] font-medium text-t3 hover:text-red"
              aria-label="삭제"
            >
              −
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...list, ""])}
        className="self-start text-[13.5px] font-semibold text-brand"
      >
        ＋ {addLabel}
      </button>
    </div>
  );
}
