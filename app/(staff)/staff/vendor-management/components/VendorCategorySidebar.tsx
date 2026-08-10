"use client";
import React, { useState } from "react";
import { SidebarList, Button, Input } from "@/components/common";
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
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

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

  const items = [
    { id: "__all__", label: "전체", count: allVendors.length },
    ...categories.map((c) => ({
      id: String(c.id),
      label: c.label,
      count: countMap[c.id] ?? 0,
    })),
  ];

  const handleSelect = (id: string) => {
    if (id === "__all__") {
      onSelect(null);
    } else {
      onSelect(Number(id));
    }
  };

  const handleAddSubmit = async () => {
    const label = newLabel.trim();
    if (!label) return;
    await onAddCategory(label);
    setNewLabel("");
    setAdding(false);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      await handleAddSubmit();
    } else if (e.key === "Escape") {
      setAdding(false);
      setNewLabel("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <SidebarList items={items} active={activeStr} onSelect={handleSelect} />

      {adding ? (
        <div className="flex gap-1 px-1">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={handleKeyDown}
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
