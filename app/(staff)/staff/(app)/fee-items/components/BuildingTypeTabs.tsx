"use client";

import Image from "next/image";
import type { BuildingTypeDraft } from "./types";

interface BuildingTypeTabsProps {
  types: BuildingTypeDraft[];
  activeKey: string | null;
  editingKey: string | null;
  editingValue: string;
  isPending: boolean;
  canAdd: boolean;
  /** 값이 바뀌면 편집 인풋을 다시 마운트해 포커스를 되돌린다(저장 실패 후 재입력). */
  refocusToken: number;
  onSelect: (key: string) => void;
  onAdd: () => void;
  onLabelChange: (key: string, label: string) => void;
  onFinishEditing: (key: string) => void;
  onCancelEditing: (key: string) => void;
}

export function BuildingTypeTabs({
  types,
  activeKey,
  editingKey,
  editingValue,
  isPending,
  canAdd,
  refocusToken,
  onSelect,
  onAdd,
  onLabelChange,
  onFinishEditing,
  onCancelEditing,
}: BuildingTypeTabsProps) {
  return (
    <nav aria-label="건물 유형" className="h-[42px] border-b border-line bg-white px-6">
      <div className="flex h-full items-center gap-1 overflow-x-auto">
        {types.map((type) => {
          const active = type.key === activeKey;
          const editing = type.key === editingKey;
          return (
            <div
              key={type.key}
              className={`relative flex h-full shrink-0 items-center justify-center px-4 text-[14px] font-bold ${
                active ? "text-teal" : "text-t3"
              }`}
            >
              {editing ? (
                <input
                  key={refocusToken}
                  autoFocus
                  aria-label="건물 유형명"
                  className="w-16 min-w-10 border-0 border-b-[1.5px] border-teal bg-transparent px-0 py-0.5 text-[14px] leading-[normal] font-bold text-teal outline-none placeholder:font-bold placeholder:text-t4"
                  placeholder="유형명"
                  value={editingValue}
                  maxLength={20}
                  disabled={isPending}
                  onChange={(event) => onLabelChange(type.key, event.target.value)}
                  onBlur={() => onFinishEditing(type.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      onCancelEditing(type.key);
                    }
                  }}
                />
              ) : (
                <button type="button" className="h-full" onClick={() => onSelect(type.key)}>
                  {type.label || "유형명"}
                </button>
              )}
              {(active || editing) && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-teal" />}
            </div>
          );
        })}
        <button
          type="button"
          aria-label="건물 유형 추가"
          className="flex h-full w-11 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onAdd}
          disabled={!canAdd}
        >
          <Image src="/icons/fee-items/add-tab.svg" alt="" width={18} height={18} />
        </button>
      </div>
    </nav>
  );
}
