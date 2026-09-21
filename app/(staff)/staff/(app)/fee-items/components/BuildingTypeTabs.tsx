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
  onSelect: (key: string) => void;
  onAdd: () => void;
  onLabelChange: (key: string, label: string) => void;
  onFinishEditing: (key: string) => void;
  onCancelEditing: () => void;
}

export function BuildingTypeTabs({
  types,
  activeKey,
  editingKey,
  editingValue,
  isPending,
  canAdd,
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
              className={`relative flex h-full shrink-0 items-center justify-center px-4 text-[14px] font-bold ${type.id == null ? "min-w-24" : ""} ${
                active ? "text-teal" : "text-t3"
              }`}
            >
              {editing ? (
                <input
                  autoFocus
                  aria-label="건물 유형명"
                  className="w-[86px] border-0 bg-transparent p-0 text-center text-[14px] font-bold text-teal outline-none placeholder:font-bold placeholder:text-t4"
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
                      onCancelEditing();
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
