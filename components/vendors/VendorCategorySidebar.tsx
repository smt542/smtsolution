"use client";
import React, { useState } from "react";
import { Button, Modal } from "@/components/common";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";
import type { Vendor } from "@/hooks/reactquery/vendors";
import styles from "./VendorManagement.module.css";

interface Props {
  categories: VendorCategory[];
  allVendors: Vendor[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onAddCategory: (label: string) => Promise<void>;
  onRenameCategory: (id: number, label: string) => Promise<void>;
  onDeleteCategory?: (id: number) => Promise<void>;
}

export function VendorCategorySidebar({
  categories,
  allVendors,
  selectedId,
  onSelect,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [deletingCategory, setDeletingCategory] = useState<VendorCategory | null>(null);

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

  return (
    <aside className={styles.categories} aria-label="협력업체 구분">
      <div className={styles.categoryHeader}>
        <h2 className={styles.categoryTitle}>구분</h2>
        <button
          type="button"
          className={styles.categoryAdd}
          aria-label="구분 추가"
          onClick={() => setAdding(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <ul className={styles.categoryList}>
        {/* "전체" item — single-click only, no rename */}
        <li key="__all__">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`${styles.categoryItem} ${isActive("__all__") ? styles.categoryItemActive : ""}`}
            aria-pressed={isActive("__all__")}
          >
            <span className={styles.categoryLabel}>전체</span>
            <span className={styles.categoryCount}>{allVendors.length}</span>
          </button>
        </li>

        {adding && (
          <li className={styles.categoryEditRow}>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={handleAddKeyDown}
              onBlur={() => {
                if (newLabel.trim()) void handleAddSubmit();
                else setAdding(false);
              }}
              placeholder="구분명"
              aria-label="새 구분명"
              autoFocus
              className={styles.categoryInput}
            />
          </li>
        )}

        {/* Real category items — double-click label to rename */}
        {categories.map((c) => {
          const active = isActive(String(c.id));
          const count = countMap[c.id] ?? 0;
          const isEditing = editingId === c.id;

          return (
            <li key={c.id}>
              {isEditing ? (
                <div className={styles.categoryEditRow}>
                  <input
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onKeyDown={(e) => handleRenameKeyDown(e, c.id, c.label)}
                    onBlur={() => commitRename(c.id, c.label)}
                    aria-label="구분 이름 변경"
                    autoFocus
                    className={styles.categoryInput}
                  />
                </div>
              ) : (
                <div className={styles.categoryRow}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    onDoubleClick={() => startRename(c.id, c.label)}
                    className={`${styles.categoryItem} ${active ? styles.categoryItemActive : ""}`}
                    aria-pressed={active}
                  >
                    <span className={styles.categoryLabel}>{c.label}</span>
                    <span className={styles.categoryCount}>{count}</span>
                  </button>
                  {onDeleteCategory && (
                    <button
                      type="button"
                      aria-label={`${c.label} 구분 삭제`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingCategory(c);
                      }}
                      className={styles.categoryDelete}
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Category delete confirm modal */}
      <Modal
        open={deletingCategory !== null}
        onClose={() => setDeletingCategory(null)}
        title="구분 삭제"
        overlayClassName="z-[320] bg-[rgba(23,31,40,.5)] p-6"
      >
        <p className="text-sm text-t2">
          이 구분을 삭제하면 소속 업체는 미분류가 됩니다. 삭제할까요?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDeletingCategory(null)}>
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={async () => {
              if (!deletingCategory || !onDeleteCategory) return;
              const id = deletingCategory.id;
              setDeletingCategory(null);
              await onDeleteCategory(id);
            }}
          >
            삭제
          </Button>
        </div>
      </Modal>
    </aside>
  );
}
