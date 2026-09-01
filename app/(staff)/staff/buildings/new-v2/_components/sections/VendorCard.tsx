"use client";
import { FieldRenderer } from "../ui/FieldRenderer";
import { PhotoUpload } from "../ui/PhotoUpload";
import { TextAreaField } from "../ui/TextAreaField";
import type { FieldDef } from "../config/types";
import type { RegisterVendorEntry } from "../config/formState";

/** 한 업체 아코디언의 펼침 내용(제어형): 필드 그리드 + 계약서 사진 + 비고.
 *  계약서 사진은 프로토타입 동작(로컬 미리보기)만 제공하며 서버 저장 대상이 아니다. */
export function VendorCard({
  fields,
  value,
  onChange,
}: {
  fields: FieldDef[];
  value: RegisterVendorEntry;
  onChange: (next: RegisterVendorEntry) => void;
}) {
  const setField = (label: string, v: string) => onChange({ ...value, fields: { ...value.fields, [label]: v } });
  return (
    <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
      {fields.map((f) => (
        <FieldRenderer key={f.label} field={f} value={value.fields[f.label]} onChange={(v) => setField(f.label, v)} />
      ))}
      <PhotoUpload label="계약서 사진" max={10} />
      <TextAreaField
        label="비고"
        placeholder="비고를 입력하세요…"
        minHeight={76}
        value={value.memo}
        onChange={(v) => onChange({ ...value, memo: v })}
      />
    </div>
  );
}
