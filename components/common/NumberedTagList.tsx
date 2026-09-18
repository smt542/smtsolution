import React from "react";
import { CloseIcon } from "@/components/icons";
import { Input } from "./Input";

export type NumberedTagItem = {
  id: string;
  label: string;
};

export type NumberedTagListProps = {
  items: NumberedTagItem[];
  max: number;
  columns: number;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  addLabel: string;
  className?: string;
};

export function NumberedTagList({
  items,
  max,
  columns,
  onRename,
  onDelete,
  onAdd,
  addLabel,
  className = "",
}: NumberedTagListProps) {
  return (
    <div className={className}>
      <div
        className="grid grid-cols-[repeat(var(--numbered-tag-columns),minmax(0,1fr))] gap-[8px]"
        style={{ "--numbered-tag-columns": columns } as React.CSSProperties}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex h-[52px] min-w-0 items-center gap-[8px] rounded-[12px] border border-line2 bg-bg pl-[11px] pr-[9px]"
          >
            <span className="w-[22px] shrink-0 text-[13px] font-bold leading-none text-t4 tabular-nums">
              {index + 1}
            </span>
            <Input
              size="36"
              aria-label={`항목 ${index + 1}`}
              value={item.label}
              onChange={(event) => onRename(item.id, event.target.value)}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              aria-label={`${item.label} 삭제`}
              onClick={() => onDelete(item.id)}
              className="grid size-[28px] shrink-0 place-items-center rounded-[8px] text-t4 hover:bg-white hover:text-danger"
            >
              <CloseIcon className="size-[14px]" />
            </button>
          </div>
        ))}
      </div>
      {/* 정본은 추가 버튼이 그리드 아래 왼쪽에 단독으로 놓인다.
          `n / max` 카운터는 이 목록이 아니라 카드 헤더 우측에 있으므로(Panel의 action)
          여기서 그리지 않는다. */}
      <button
        type="button"
        onClick={onAdd}
        disabled={items.length >= max}
        className="mt-[10px] h-[38px] w-[101px] rounded-[11px] border border-line bg-white px-[8px] text-[13.5px] font-bold text-t2 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:bg-bg disabled:text-t4"
      >
        {addLabel}
      </button>
    </div>
  );
}
