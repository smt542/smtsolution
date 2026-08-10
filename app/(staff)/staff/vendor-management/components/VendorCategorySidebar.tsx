"use client";
import React, { useState } from "react";
import { Button, Input } from "@/components/common";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";
import type { Vendor } from "@/hooks/reactquery/vendors";

interface Props {
  categories: VendorCategory[];
  allVendors: Vendor[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onAddCategory: (label: string) => Promise<void>;
  onRenameCategory: (id: number, label: string) => Promise<void>;
}

export function VendorCategorySidebar({
  categories,
  allVendors,
  selectedId,
  onSelect,
  onAddCategory,
  onRenameCategory,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  // Count vendors per category
  const countMap = React.useMemo(() => {
    const m: Record<number, number> = {};
    for (const v of allVendors) {
      if (v.categoryId != null) {
        m[v.categoryId] = (m[v.categoryId] ?? 0) + 1;
      }
    }
    return m;
  }, [allVendors]);

  const activeStr = selectedId === null ? "__all__" : String(selectedId);

  const handleAddSubmit = async () => {
    const label = newLabel.trim();
    if (!label) return;
    await onAddCategory(label);
    setNewLabel("");
    setAdding(false);
  };

  const handleAddKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      await handleAddSubmit();
    } else if (e.key === "Escape") {
      setAdding(false);
      setNewLabel("");
    }
  };

  const startRename = (id: number, currentLabel: string) => {
    setEditingId(id);
    setEditingLabel(currentLabel);
  };

  const commitRename = async (id: number, originalLabel: string) => {
    const trimmed = editingLabel.trim();
    setEditingId(null);
    setEditingLabel("");
    if (trimmed && trimmed !== originalLabel) {
      await onRenameCategory(id, trimmed);
    }
  };

  const handleRenameKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: number,
    originalLabel: string
  ) => {
    if (e.key === "Enter") {
      await commitRename(id, originalLabel);
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditingLabel("");
    }
  };

  const isActive = (id: string) => activeStr === id;

  const itemCls = (active: boolean) =>
    `flex w-full items-center justify-between rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
      active ? "bg-brand text-white" : "text-t2 hover:bg-bg"
    }`;

  const countCls = (active: boolean) =>
    `text-xs ${active ? "text-white/80" : "text-t4"}`;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {/* "전체" item — single-click only, no rename */}
        <li key="__all__">
          <button
            onClick={() => onSelect(null)}
            className={itemCls(isActive("__all__"))}
          >
            <span>전체</span>
            <span className={countCls(isActive("__all__"))}>{allVendors.length}</span>
          </button>
        </li>

        {/* Real category items — double-click label to rename */}
        {categories.map((c) => {
          const active = isActive(String(c.id));
          const count = countMap[c.id] ?? 0;
          const isEditing = editingId === c.id;

          return (
            <li key={c.id}>
              {isEditing ? (
                <div className="flex gap-1 px-1 py-1">
                  <Input
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onKeyDown={(e) => handleRenameKeyDown(e, c.id, c.label)}
                    onBlur={() => commitRename(c.id, c.label)}
                    aria-label="구분 이름 변경"
                    autoFocus
                    className="text-sm"
                  />
                </div>
              ) : (
                <button
                  onClick={() => onSelect(c.id)}
                  onDoubleClick={() => startRename(c.id, c.label)}
                  className={itemCls(active)}
                >
                  <span>{c.label}</span>
                  <span className={countCls(active)}>{count}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="flex gap-1 px-1">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="구분명"
            autoFocus
            className="text-sm"
          />
          <Button variant="primary" onClick={handleAddSubmit} type="button">
            추가
          </Button>
          <Button
            variant="ghost"
            onClick={() => { setAdding(false); setNewLabel(""); }}
            type="button"
          >
            취소
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          onClick={() => setAdding(true)}
          type="button"
          className="w-full text-sm"
        >
          ＋ 구분 추가
        </Button>
      )}
    </div>
  );
}
