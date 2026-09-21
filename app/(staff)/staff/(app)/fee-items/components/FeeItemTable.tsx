"use client";

import { useState } from "react";
import type { FeeItemDraft } from "./types";
import { FeeItemRow, type FeeItemDropPosition } from "./FeeItemRow";

interface FeeItemTableProps {
  items: FeeItemDraft[];
  isReorderPending: boolean;
  onEdit: (item: FeeItemDraft) => void;
  onReorder: (draggedKey: string, targetKey: string, position: FeeItemDropPosition) => void;
}

export function FeeItemTable({ items, isReorderPending, onEdit, onReorder }: FeeItemTableProps) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    targetKey: string;
    position: FeeItemDropPosition;
  } | null>(null);

  const getDropIndicator = (targetKey: string, position: FeeItemDropPosition) => {
    if (!draggedKey || isReorderPending) return null;

    const optionalKeys = items
      .filter((item) => !item.isRequired && item.id != null)
      .map((item) => item.key);
    const draggedIndex = optionalKeys.indexOf(draggedKey);
    const targetIndex = optionalKeys.indexOf(targetKey);
    if (draggedIndex < 0 || targetIndex < 0) return null;

    const isNoOp = draggedKey === targetKey
      || (position === "before" && targetIndex === draggedIndex + 1)
      || (position === "after" && targetIndex === draggedIndex - 1);
    return isNoOp ? null : { targetKey, position };
  };

  const clearDragState = () => {
    setDraggedKey(null);
    setDropIndicator(null);
  };

  const handleDragOver = (targetKey: string, position: FeeItemDropPosition | null) => {
    const next = position == null ? null : getDropIndicator(targetKey, position);
    // dragover 는 끌고 있는 내내 연속 발생하므로, 삽입 위치가 그대로면 같은 참조를 돌려줘 리렌더를 건너뛴다.
    setDropIndicator((current) => {
      if (current == null || next == null) return current === next ? current : next;
      return current.targetKey === next.targetKey && current.position === next.position ? current : next;
    });
  };

  const handleDrop = (targetKey: string, position: FeeItemDropPosition | null) => {
    if (draggedKey && position != null) {
      const indicator = getDropIndicator(targetKey, position);
      if (indicator) onReorder(draggedKey, targetKey, position);
    }
    clearDragState();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="h-9 bg-[#fbfcfd] text-left text-[12px] font-bold text-t3">
            <th aria-label="상태" className="w-11" />
            <th className="w-[24%] px-4">항목 명칭</th>
            <th className="px-4">반올림</th>
            <th className="px-4">일자계산</th>
            <th className="px-4">이월</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <FeeItemRow
              key={item.key}
              item={item}
              isReorderPending={isReorderPending}
              onEdit={onEdit}
              dragged={draggedKey === item.key}
              dropPosition={dropIndicator?.targetKey === item.key ? dropIndicator.position : null}
              onDragStart={(key) => {
                setDraggedKey(key);
                setDropIndicator(null);
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={clearDragState}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
