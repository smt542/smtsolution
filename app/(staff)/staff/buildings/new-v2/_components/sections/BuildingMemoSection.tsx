"use client";
import { useState } from "react";
import { FormSection } from "../ui/FormSection";
import { TextAreaField } from "../ui/TextAreaField";

/** ⑥ 건물 메모 (Figma 673:57286). */
export function BuildingMemoSection() {
  const [memo, setMemo] = useState("");
  return (
    <FormSection index={6} title="건물 메모">
      <TextAreaField
        placeholder="건물 관련 메모를 입력하세요… (최대 1,000자)"
        value={memo}
        onChange={(v) => setMemo(v.slice(0, 1000))}
        minHeight={120}
        footer={`${memo.length.toLocaleString()}/1,000자`}
      />
    </FormSection>
  );
}
