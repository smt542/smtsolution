"use client";
import React from "react";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";
import type { Vendor } from "@/hooks/reactquery/vendors";
import { vendorClasses } from "./vendorClasses";

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
    <aside className={vendorClasses.categories} aria-label="협력업체 구분">
      <div className={vendorClasses.categoryHeader}>
        <h2 className={vendorClasses.categoryTitle}>구분</h2>
      </div>

      <ul className={vendorClasses.categoryList}>
        {/* "전체" item — single-click only, no rename */}
        <li key="__all__">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`${vendorClasses.categoryItem} ${isActive("__all__") ? vendorClasses.categoryItemActive : ""}`}
            aria-pressed={isActive("__all__")}
          >
            <span className={vendorClasses.categoryLabel}>전체</span>
            <span className={`${vendorClasses.categoryCount} ${isActive("__all__") ? "bg-surface text-blue" : ""}`}>{allVendors.length}</span>
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
                className={`${vendorClasses.categoryItem} ${active ? vendorClasses.categoryItemActive : ""}`}
                aria-pressed={active}
              >
                <span className={vendorClasses.categoryLabel}>{c.label}</span>
                <span className={`${vendorClasses.categoryCount} ${active ? "bg-surface text-blue" : ""}`}>{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
