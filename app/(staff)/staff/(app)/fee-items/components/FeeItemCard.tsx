"use client";

import Image from "next/image";
import { useState } from "react";
import type { BuildingTypeDraft, FeeItemDraft } from "./types";
import { FeeItemTable } from "./FeeItemTable";

interface FeeItemCardProps {
  type: BuildingTypeDraft;
  dirty: boolean;
  saving: boolean;
  onAddItem: () => void;
  onEditItem: (item: FeeItemDraft) => void;
  onReorder: (draggedKey: string, targetKey: string) => void;
  onDeleteType: () => void;
  onSave: () => void;
  onLabelChange: (key: string, label: string) => void;
  onFinishEditing: () => void;
}

export function FeeItemCard({ type, dirty, saving, onAddItem, onEditItem, onReorder, onDeleteType, onSave, onLabelChange, onFinishEditing }: FeeItemCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-card">
      <header className="flex h-[70px] items-center justify-between border-b border-line2 px-[18px]">
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              autoFocus
              aria-label="건물 유형명"
              className="w-[130px] border-0 border-b-[1.5px] border-teal bg-transparent p-0 text-[15px] font-extrabold text-teal outline-none"
              value={type.label}
              maxLength={20}
              onChange={(event) => onLabelChange(type.key, event.target.value)}
              onBlur={() => { setEditing(false); onFinishEditing(); }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }}
            />
          ) : (
            <>
              <h1 className="text-[15px] font-extrabold text-t1">{type.label || "유형명"}</h1>
              <button
                type="button"
                aria-label="건물 유형명 수정"
                className="flex h-[21px] w-[21px] items-center justify-center rounded-md text-t4 hover:bg-bg hover:text-teal"
                onClick={() => setEditing(true)}
              >
                <Image src="/icons/fee-items/edit.svg" alt="" width={15} height={15} />
              </button>
            </>
          )}
          <span className="rounded-lg bg-bg px-2 py-1 text-[11px] font-bold text-t3">{type.items.length}개</span>
        </div>
        <button type="button" className="flex h-10 items-center gap-2 rounded-[12px] bg-teal px-4 text-[13px] font-bold text-white shadow-[0_7px_14px_-5px_rgba(20,164,151,.65)] disabled:cursor-not-allowed disabled:opacity-50" onClick={onAddItem}>
          <Image src="/icons/fee-items/plus.svg" alt="" width={16} height={16} />
          항목 추가
        </button>
      </header>

      <FeeItemTable items={type.items} onEdit={onEditItem} onReorder={onReorder} />

      <footer className="flex h-[62px] items-center justify-between border-t border-line2 px-[18px]">
        <div>
          {dirty && (
            <button type="button" className="h-9 rounded-[11px] bg-teal px-4 text-[12px] font-bold text-white disabled:opacity-50" disabled={saving} onClick={onSave}>
              {saving ? "저장 중…" : "변경 내용 저장"}
            </button>
          )}
        </div>
        <button type="button" className="flex h-9 items-center gap-1.5 rounded-[10px] border border-line px-3 text-[12px] font-bold text-red hover:bg-red-t" onClick={onDeleteType}>
          <Image src="/icons/fee-items/trash.svg" alt="" width={15} height={15} />
          건물 유형 삭제
        </button>
      </footer>
    </section>
  );
}
