"use client";

import Image from "next/image";
import type { BuildingTypeDraft } from "./types";

interface BuildingTypeTabsProps {
  types: BuildingTypeDraft[];
  activeKey: string | null;
  editingKey: string | null;
  onSelect: (key: string) => void;
  onAdd: () => void;
  onLabelChange: (key: string, label: string) => void;
  onFinishEditing: () => void;
}

export function BuildingTypeTabs({
  types,
  activeKey,
  editingKey,
  onSelect,
  onAdd,
  onLabelChange,
  onFinishEditing,
}: BuildingTypeTabsProps) {
  return (
    <nav aria-label="건물 유형" className="h-[46px] border-b border-line bg-white px-6">
      <div className="flex h-full items-center gap-1 overflow-x-auto">
        {types.map((type) => {
          const active = type.key === activeKey;
          const editing = type.key === editingKey;
          return (
            <div
              key={type.key}
              className={`relative flex h-full shrink-0 items-center justify-center px-4 text-[13px] font-bold ${type.id == null ? "min-w-24" : ""} ${
                active ? "text-teal" : "text-t3"
              }`}
            >
              {editing ? (
                <input
                  autoFocus
                  aria-label="건물 유형명"
                  className="h-8 w-[86px] rounded-lg border border-teal px-2 text-[13px] font-bold text-t1 outline-none ring-2 ring-teal-t"
                  value={type.label}
                  maxLength={20}
                  onChange={(event) => onLabelChange(type.key, event.target.value)}
                  onBlur={onFinishEditing}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Escape") {
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <button type="button" className="h-full" onClick={() => onSelect(type.key)}>
                  {type.label || "유형명"}
                </button>
              )}
              {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-teal" />}
            </div>
          );
        })}
        <button
          type="button"
          aria-label="건물 유형 추가"
          className="flex h-full w-11 shrink-0 items-center justify-center"
          onClick={onAdd}
        >
          <Image src="/icons/fee-items/add-tab.svg" alt="" width={18} height={18} />
        </button>
      </div>
    </nav>
  );
}
