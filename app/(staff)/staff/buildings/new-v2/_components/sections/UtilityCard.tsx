"use client";
import { useState } from "react";
import { FieldRenderer } from "../ui/FieldRenderer";
import type { FieldDef } from "../config/types";

/** 유틸 아코디언 안의 "고객번호 N" 카드. */
export function UtilityCard({
  index,
  fields,
  onRemove,
}: {
  index: number;
  fields: FieldDef[];
  onRemove?: () => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const set = (k: string) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  return (
    <div className="rounded-[10px] border border-line bg-[#fbfcfd] p-[14px]">
      <div className="mb-[12px] flex items-center justify-between">
        <span className="text-[13px] font-bold text-t1">고객번호 {index}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-[12px] font-semibold text-t3 hover:text-red">
            삭제
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
        {fields.map((f) => (
          <FieldRenderer key={f.label} field={f} value={v[f.label]} onChange={set(f.label)} />
        ))}
      </div>
    </div>
  );
}
