"use client";
import { FormGrid } from "@/components/common/FormGrid";
import { FieldRenderer } from "../ui/FieldRenderer";
import type { FieldDef } from "../config/types";

/** 유틸 아코디언 안의 "고객번호 N" 카드(제어형). */
export function UtilityCard({
  index,
  fields,
  values,
  onChange,
  onRemove,
}: {
  index: number;
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (label: string, value: string) => void;
  onRemove?: () => void;
}) {
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
      <FormGrid>
        {fields.map((f) => (
          <FieldRenderer key={f.label} field={f} value={values[f.label]} onChange={(v) => onChange(f.label, v)} />
        ))}
      </FormGrid>
    </div>
  );
}
