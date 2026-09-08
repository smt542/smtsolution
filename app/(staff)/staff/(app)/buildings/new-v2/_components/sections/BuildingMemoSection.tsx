"use client";
import { CollapsibleFormSection } from "@/components/common/CollapsibleFormSection";
import { TextAreaField } from "../ui/TextAreaField";
import type { RegisterFormState } from "../config/formState";

/** ⑥ 건물 메모 (Figma 673:57286). */
export function BuildingMemoSection({
  value,
  patch,
}: {
  value: RegisterFormState;
  patch: (p: Partial<RegisterFormState>) => void;
}) {
  const memo = value.memo;
  return (
    <CollapsibleFormSection index={6} title="건물 메모">
      <TextAreaField
        placeholder="건물 관련 메모를 입력하세요… (최대 1,000자)"
        value={memo}
        onChange={(v) => patch({ memo: v.slice(0, 1000) })}
        minHeight={120}
        footer={`${memo.length.toLocaleString()}/1,000자`}
      />
    </CollapsibleFormSection>
  );
}
