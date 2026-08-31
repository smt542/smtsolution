"use client";
import { useState } from "react";
import { FieldRenderer } from "../ui/FieldRenderer";
import { PhotoUpload } from "../ui/PhotoUpload";
import { TextAreaField } from "../ui/TextAreaField";
import type { FieldDef } from "../config/types";

/** 한 업체 아코디언의 펼침 내용: 필드 그리드 + 계약서 사진 + 비고. */
export function VendorCard({ fields }: { fields: FieldDef[] }) {
  const [v, setV] = useState<Record<string, string>>({});
  const set = (k: string) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  return (
    <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
      {fields.map((f) => (
        <FieldRenderer key={f.label} field={f} value={v[f.label]} onChange={set(f.label)} />
      ))}
      <PhotoUpload label="계약서 사진" max={10} />
      <TextAreaField label="비고" placeholder="비고를 입력하세요…" minHeight={76} />
    </div>
  );
}
