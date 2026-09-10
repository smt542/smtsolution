"use client";
import React from "react";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";
import type { Vendor } from "@/hooks/reactquery/vendors";
import styles from "./VendorManagement.module.css";

interface Props {
  categories: VendorCategory[];
  allVendors: Vendor[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export function VendorCategorySidebar({
  categories,
  allVendors,
  selectedId,
  onSelect,
}: Props) {
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

  const isActive = (id: string) => activeStr === id;

  return (
    <aside className={styles.categories} aria-label="협력업체 구분">
      <div className={styles.categoryHeader}>
        <h2 className={styles.categoryTitle}>구분</h2>
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

        {/* 고정 구분 8종 — 추가·수정·삭제하지 않는다. */}
        {categories.map((c) => {
          const active = isActive(String(c.id));
          const count = countMap[c.id] ?? 0;

          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={`${styles.categoryItem} ${active ? styles.categoryItemActive : ""}`}
                aria-pressed={active}
              >
                <span className={styles.categoryLabel}>{c.label}</span>
                <span className={styles.categoryCount}>{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
