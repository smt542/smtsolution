"use client";
import { useState } from "react";
import { UtilityCard } from "./UtilityCard";
import { FieldRenderer } from "../ui/FieldRenderer";
import { PlusIcon } from "@/components/icons";
import type { FieldDef } from "../config/types";

/** 유틸 아코디언 내용: 고객번호 카드 목록 + 추가 버튼 + (가스) 하단 공통 필드. */
export function UtilityPanel({ fields, extra }: { fields: FieldDef[]; extra?: FieldDef[] }) {
  const [cards, setCards] = useState<number[]>([1]);
  const [ex, setEx] = useState<Record<string, string>>({});
  return (
    <div className="flex flex-col gap-[14px]">
      {cards.map((id, i) => (
        <UtilityCard
          key={id}
          index={i + 1}
          fields={fields}
          onRemove={cards.length > 1 ? () => setCards((cs) => cs.filter((c) => c !== id)) : undefined}
        />
      ))}
      <button
        type="button"
        onClick={() => setCards((cs) => [...cs, (cs.at(-1) ?? 0) + 1])}
        className="flex w-full items-center justify-center gap-[4px] rounded-[10px] border border-dashed border-line py-[11px] text-[13px] font-bold text-teal transition-colors hover:bg-teal-t"
      >
        <PlusIcon className="size-[16px]" />
        고객번호 추가
      </button>
      {extra && (
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
          {extra.map((f) => (
            <FieldRenderer
              key={f.label}
              field={f}
              value={ex[f.label]}
              onChange={(val) => setEx((s) => ({ ...s, [f.label]: val }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
