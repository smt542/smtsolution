"use client";

import Image from "next/image";
import { useState } from "react";
import { Badge, Button } from "@/components/common";
import type { BuildingTypeDraft, FeeItemDraft } from "./types";
import { FeeItemTable } from "./FeeItemTable";
import type { FeeItemDropPosition } from "./FeeItemRow";

interface FeeItemCardProps {
  type: BuildingTypeDraft;
  isRenamePending: boolean;
  isReorderPending: boolean;
  onAddItem: () => void;
  onEditItem: (item: FeeItemDraft) => void;
  onReorder: (draggedKey: string, targetKey: string, position: FeeItemDropPosition) => void;
  onDeleteType: () => void;
  onRename: (label: string) => Promise<boolean>;
}

export function FeeItemCard({
  type,
  isRenamePending,
  isReorderPending,
  onAddItem,
  onEditItem,
  onReorder,
  onDeleteType,
  onRename,
}: FeeItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [labelValue, setLabelValue] = useState(type.label);

  const finishEditing = async () => {
    if (!editing || isRenamePending) return;
    const nextLabel = labelValue.trim();
    if (!nextLabel || nextLabel === type.label.trim()) {
      setLabelValue(type.label);
      setEditing(false);
      return;
    }

    const updated = await onRename(nextLabel);
    if (updated) {
      setLabelValue(nextLabel);
      setEditing(false);
    } else {
      setLabelValue(type.label);
    }
  };

  const cancelEditing = () => {
    setLabelValue(type.label);
    setEditing(false);
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-card">
      <header className="flex h-[70px] items-center justify-between border-b border-line2 px-[18px]">
        <div className="flex items-center gap-1.5">
          {editing ? (
            <input
              autoFocus
              aria-label="건물 유형명"
              className="w-[130px] border-0 border-b-[1.5px] border-teal bg-transparent p-0 text-[15px] font-extrabold text-teal outline-none"
              value={labelValue}
              maxLength={20}
              disabled={isRenamePending}
              onChange={(event) => setLabelValue(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => { void finishEditing(); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEditing();
                }
              }}
            />
          ) : (
            <>
              <h1 className="text-[15px] font-extrabold text-t1">{type.label || "유형명"}</h1>
              <button
                type="button"
                aria-label="건물 유형명 수정"
                className="flex h-[21px] w-[21px] items-center justify-center rounded-md text-t4 hover:bg-bg hover:text-teal"
                onClick={() => { setLabelValue(type.label); setEditing(true); }}
                disabled={isRenamePending}
              >
                <Image src="/icons/fee-items/edit.svg" alt="" width={15} height={15} />
              </button>
            </>
          )}
          {/* 정본 .badge.b-gray: 제목·연필과 6px, 칩은 10px(gap-1.5 + ml-1) */}
          <Badge tone="gray" className="ml-1 inline-flex px-[9px] py-[3px] leading-[1.4]">{type.items.length}개</Badge>
        </div>
        {/* 정본 .hf-btn.pri: 1px 투명 테두리까지 폭에 들어가고, hover 색 변화가 없다(기존처럼 hover 없음 유지) */}
        <Button className="border border-transparent hover:bg-brand" onClick={onAddItem}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          항목 추가
        </Button>
      </header>

      <FeeItemTable items={type.items} isReorderPending={isReorderPending} onEdit={onEditItem} onReorder={onReorder} />

      <footer className="flex h-[62px] items-center justify-end border-t border-line2 px-[18px]">
        <button type="button" disabled={isRenamePending} className="flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-3 text-[12px] font-bold text-red hover:bg-red-t disabled:cursor-not-allowed disabled:opacity-50" onClick={onDeleteType}>
          <Image src="/icons/fee-items/trash.svg" alt="" width={15} height={15} />
          건물 유형 삭제
        </button>
      </footer>
    </section>
  );
}
