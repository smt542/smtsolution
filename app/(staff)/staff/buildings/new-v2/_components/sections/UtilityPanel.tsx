"use client";
import { UtilityCard } from "./UtilityCard";
import { FieldRenderer } from "../ui/FieldRenderer";
import { PlusIcon } from "@/components/icons";
import type { FieldDef } from "../config/types";
import type { BuildingUtilityEntry } from "@/hooks/reactquery/buildings";

/** 유틸 아코디언 내용(제어형): 고객번호 카드 목록 + 추가/삭제 + (가스) 하단 공통 필드. */
export function UtilityPanel({
  fields,
  extra,
  value,
  onChange,
}: {
  fields: FieldDef[];
  extra?: FieldDef[];
  value: BuildingUtilityEntry;
  onChange: (next: BuildingUtilityEntry) => void;
}) {
  const cards = value.cards.length > 0 ? value.cards : [{}];

  const setCard = (i: number, label: string, v: string) => {
    const next = cards.map((c, j) => (j === i ? { ...c, [label]: v } : c));
    onChange({ ...value, cards: next });
  };
  const addCard = () => onChange({ ...value, cards: [...cards, {}] });
  const removeCard = (i: number) => onChange({ ...value, cards: cards.filter((_, j) => j !== i) });
  const setExtra = (label: string, v: string) => onChange({ ...value, extra: { ...value.extra, [label]: v } });

  return (
    <div className="flex flex-col gap-[14px]">
      {cards.map((card, i) => (
        <UtilityCard
          key={i}
          index={i + 1}
          fields={fields}
          values={card}
          onChange={(label, v) => setCard(i, label, v)}
          onRemove={cards.length > 1 ? () => removeCard(i) : undefined}
        />
      ))}
      <button
        type="button"
        onClick={addCard}
        className="flex w-full items-center justify-center gap-[4px] rounded-[10px] border border-dashed border-line py-[11px] text-[13px] font-bold text-teal transition-colors hover:bg-teal-t"
      >
        <PlusIcon className="size-[16px]" />
        고객번호 추가
      </button>
      {extra && (
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
          {extra.map((f) => (
            <FieldRenderer key={f.label} field={f} value={value.extra[f.label]} onChange={(v) => setExtra(f.label, v)} />
          ))}
        </div>
      )}
    </div>
  );
}
