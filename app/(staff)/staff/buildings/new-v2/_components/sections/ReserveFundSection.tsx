"use client";
import { FormSection } from "../ui/FormSection";
import { SelectField } from "../ui/SelectField";
import { TextAreaField } from "../ui/TextAreaField";
import type { RegisterFormState } from "../config/formState";

const FUND_TYPES = ["적립금", "장기수선충당금", "기타", "없음"];

/** ③ 적립금 (Figma 673:56624). */
export function ReserveFundSection({
  value,
  patch,
}: {
  value: RegisterFormState;
  patch: (p: Partial<RegisterFormState>) => void;
}) {
  return (
    <FormSection index={3} title="적립금">
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
        <SelectField label="유형" options={FUND_TYPES} value={value.reserveFundType} onChange={(v) => patch({ reserveFundType: v })} />
        <TextAreaField label="메모" placeholder="적립금 관련 메모를 입력하세요…" value={value.reserveFundMemo} onChange={(v) => patch({ reserveFundMemo: v })} />
      </div>
    </FormSection>
  );
}
