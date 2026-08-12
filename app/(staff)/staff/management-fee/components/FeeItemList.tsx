"use client";
import React from "react";
import { EmptyState, Spinner } from "@/components/common";
import type { FeeItem } from "@/hooks/reactquery/feeItems";

const ROUNDING_LABEL: Record<string, string> = {
  up: "절상",
  round: "4사5입",
  down: "절하",
  raw: "그대로",
};

interface Props {
  items: FeeItem[];
  isLoading: boolean;
  onEdit: (item: FeeItem) => void;
  onDelete: (item: FeeItem) => void;
  onMoveUp: (item: FeeItem) => void;
  onMoveDown: (item: FeeItem) => void;
}

export function FeeItemList({ items, isLoading, onEdit, onDelete, onMoveUp, onMoveDown }: Props) {
  if (isLoading) return <Spinner />;

  const required = items.filter((i) => i.isRequired);
  const optional = items.filter((i) => !i.isRequired);
  const ordered = [...required, ...optional];

  if (ordered.length === 0) {
    return <EmptyState message="등록된 항목이 없습니다. ＋ 항목 추가를 눌러 등록하세요." />;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-t3">
          <th className="py-2 pr-4 font-semibold">항목명칭</th>
          <th className="py-2 pr-4 font-semibold">반올림</th>
          <th className="py-2 pr-4 font-semibold">일자계산</th>
          <th className="py-2 pr-4 font-semibold">이월</th>
          <th className="py-2 font-semibold">순서</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {ordered.map((item) => {
          // within required group: only move among required; within optional: only among optional
          const groupItems = item.isRequired ? required : optional;
          const groupIdx = groupItems.findIndex((g) => g.id === item.id);
          const isGroupFirst = groupIdx === 0;
          const isGroupLast = groupIdx === groupItems.length - 1;

          return (
            <tr key={item.id} className="border-b border-line hover:bg-bg" role="row">
              <td className="py-2 pr-4 font-medium text-t1">
                {item.name}
                {item.isRequired && (
                  <span className="ml-1 rounded bg-brand/10 px-1.5 py-0.5 text-xs text-brand">필수</span>
                )}
              </td>
              <td className="py-2 pr-4 text-t2">{ROUNDING_LABEL[item.rounding] ?? item.rounding}</td>
              <td className="py-2 pr-4 text-t2">{item.dailyProration ? "적용" : "안함"}</td>
              <td className="py-2 pr-4 text-t2">{item.carryOver ? "이월" : "안함"}</td>
              <td className="py-2 pr-4">
                <div className="flex gap-1">
                  <button
                    className="rounded px-1.5 py-0.5 text-xs text-t3 hover:bg-line disabled:opacity-30"
                    onClick={() => onMoveUp(item)}
                    disabled={isGroupFirst}
                    aria-label={`${item.name} 위로`}
                  >
                    ▲
                  </button>
                  <button
                    className="rounded px-1.5 py-0.5 text-xs text-t3 hover:bg-line disabled:opacity-30"
                    onClick={() => onMoveDown(item)}
                    disabled={isGroupLast}
                    aria-label={`${item.name} 아래로`}
                  >
                    ▼
                  </button>
                </div>
              </td>
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs text-t3 hover:text-brand"
                    onClick={() => onEdit(item)}
                    aria-label={`${item.name} 수정`}
                  >
                    수정
                  </button>
                  {!item.isRequired && (
                    <button
                      className="text-xs text-danger hover:underline"
                      onClick={() => onDelete(item)}
                      aria-label={`${item.name} 삭제`}
                      data-delete="true"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
