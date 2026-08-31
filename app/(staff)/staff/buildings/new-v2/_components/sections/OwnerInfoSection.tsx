"use client";
import { useState } from "react";
import { FormSection } from "../ui/FormSection";
import { TextField } from "../ui/TextField";
import { AddressField } from "../ui/AddressField";
import { TextAreaField } from "../ui/TextAreaField";

/** ④ 건물주 정보 (Figma 673:56656). */
export function OwnerInfoSection() {
  const [v, setV] = useState<Record<string, string>>({});
  const set = (k: string) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  return (
    <FormSection index={4} title="건물주 정보">
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
        <TextField label="건물주명" placeholder="건물주 이름" value={v.name} onChange={set("name")} />
        <TextField label="건물주 전화번호(주)" placeholder="010-0000-0000 / 02-000-0000" inputMode="tel" value={v.phone1} onChange={set("phone1")} />
        <TextField label="건물주 전화번호(부)" placeholder="010-0000-0000 / 02-000-0000" inputMode="tel" value={v.phone2} onChange={set("phone2")} />
        <AddressField label="건물주 주소" />
        <TextAreaField label="비고" placeholder="건물주 관련 메모를 입력하세요…" value={v.memo} onChange={set("memo")} />
      </div>
    </FormSection>
  );
}
