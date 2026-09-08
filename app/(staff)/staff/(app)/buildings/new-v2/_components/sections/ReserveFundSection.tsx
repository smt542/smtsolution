"use client";
import { CollapsibleFormSection } from "@/components/common/CollapsibleFormSection";
import { FormGrid } from "@/components/common/FormGrid";
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
    <CollapsibleFormSection index={3} title="적립금">
      <FormGrid>
        <SelectField label="유형" options={FUND_TYPES} value={value.reserveFundType} onChange={(v) => patch({ reserveFundType: v })} />
        <TextAreaField label="메모" placeholder="적립금 관련 메모를 입력하세요…" value={value.reserveFundMemo} onChange={(v) => patch({ reserveFundMemo: v })} />
      </FormGrid>
    </CollapsibleFormSection>
  );
}
