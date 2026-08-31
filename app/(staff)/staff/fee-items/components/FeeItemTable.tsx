"use client";

import { useState } from "react";
import type { FeeItemDraft } from "./types";
import { FeeItemRow } from "./FeeItemRow";

interface FeeItemTableProps {
  items: FeeItemDraft[];
  onEdit: (item: FeeItemDraft) => void;
  onReorder: (draggedKey: string, targetKey: string) => void;
}

export function FeeItemTable({ items, onEdit, onReorder }: FeeItemTableProps) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="h-9 bg-[#fbfcfd] text-left text-[11px] font-bold text-t3">
            <th aria-label="상태" className="w-11" />
            <th className="w-[25%] pr-5">항목 명칭</th>
            <th className="w-[26%] px-5">반올림</th>
            <th className="w-[26%] px-5">일자계산</th>
            <th className="px-5">이월</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <FeeItemRow
              key={item.key}
              item={item}
              onEdit={onEdit}
              onDragStart={setDraggedKey}
              onDrop={(targetKey) => {
                if (draggedKey && draggedKey !== targetKey) onReorder(draggedKey, targetKey);
                setDraggedKey(null);
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
