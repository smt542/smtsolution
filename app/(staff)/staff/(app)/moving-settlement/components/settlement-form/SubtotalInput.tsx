"use client";

import { useState } from "react";
import { Input } from "@/components/common";

/**
 * 소계 수기 수정 입력(QA #49, extra.subtotalOverride). 표시값 = override ?? 자동값.
 * - 입력 중에는 친 글자를 그대로 둔다(지우고 0 을 치는 흐름이 자연스럽게 되도록). 숫자를 치면 그 값이 override(0 포함).
 * - 칸을 비운 채로 벗어나면(blur) override 를 해제(null)해 자동 계산값으로 돌아간다.
 */
export function SubtotalInput({
  label,
  autoValue,
  override,
  onOverrideChange,
  className,
}: {
  label: string;
  autoValue: number;
  override: number | null | undefined;
  onOverrideChange: (next: number | null) => void;
  className: string;
}) {
  // 포커스 중 편집 텍스트(화면 표시용 로컬 상태). null = 편집 중 아님 → 현재 값 표시.
  const [editingText, setEditingText] = useState<string | null>(null);
  const shown = override ?? autoValue;

  return (
    <Input
      unstyled
      aria-label={label}
      title={override != null ? `직접 수정한 값 (자동 계산 ${autoValue.toLocaleString("ko-KR")}원) — 비우고 나가면 자동 계산값으로 돌아가요` : undefined}
      type="number"
      min={0}
      step={1}
      value={editingText ?? String(shown)}
      onFocus={() => setEditingText(String(shown))}
      onChange={(event) => {
        const raw = event.target.value;
        setEditingText(raw);
        if (raw.trim() === "") return;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        onOverrideChange(Math.max(0, Math.round(parsed)));
      }}
      onBlur={() => {
        if (editingText !== null && editingText.trim() === "") onOverrideChange(null);
        setEditingText(null);
      }}
      className={className}
    />
  );
}

/** 섹션 소계(①②③) 자리: 기존 `<strong>` 금액과 같은 글자 규격으로 보이고 포커스 때만 밑줄이 보인다. */
export const SECTION_SUBTOTAL_INPUT_CLASS =
  "ml-[10px] h-[21px] w-[130px] border-0 border-b border-transparent bg-transparent p-0 text-right text-[17px] font-extrabold leading-[21px] tracking-[-0.17px] text-teal-d outline-none [appearance:textfield] focus:border-teal [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
