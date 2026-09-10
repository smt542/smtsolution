"use client";
import { FormGrid } from "@/components/common/FormGrid";
import { FieldRenderer } from "../ui/FieldRenderer";
import { CloseIcon } from "@/components/icons";
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
    <div className="rounded-[11px] border border-line bg-[#fbfcfd] px-[13px] pb-[13px] pt-[12px]">
      <div className="mb-[11px] flex items-center gap-[8px]">
        <span className="text-[12.5px] font-extrabold leading-[normal] text-t2">고객번호 {index}</span>
        <div className="flex-1" />
        {onRemove && (
          <button
            type="button"
            aria-label={`고객번호 ${index} 삭제`}
            onClick={onRemove}
            className="flex size-[24px] items-center justify-center rounded-[7px] text-t4 hover:bg-red-t hover:text-red"
          >
            <CloseIcon className="size-[14px]" />
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
