"use client";
import React from "react";
import { Input } from "@/components/common";
import { CloseIcon, PlusIcon } from "@/components/icons";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";
import type { Vendor } from "@/hooks/reactquery/vendors";
import { vendorClasses } from "./vendorClasses";

interface Props {
  categories: VendorCategory[];
  allVendors: Vendor[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  // 구분 추가·이름 편집·삭제 — 저장 성공 시 resolve, 실패 시 reject(입력을 유지한다).
  onCreate: (label: string) => Promise<void>;
  onRename: (id: number, label: string) => Promise<void>;
  onDelete: (category: VendorCategory) => Promise<void>;
  isSaving?: boolean;
}

export function VendorCategorySidebar({
  categories,
  allVendors,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  isSaving = false,
}: Props) {
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState("");
  const committingRef = React.useRef(false);

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

  const closeEditor = () => {
    setAdding(false);
    setEditingId(null);
    setDraft("");
  };

  const startEdit = (category: VendorCategory) => {
    setAdding(false);
    setEditingId(category.id);
    setDraft(category.label);
  };

  const commit = async () => {
    const label = draft.trim();
    if (!label || isSaving || committingRef.current) return;
    committingRef.current = true;
    try {
      if (editingId !== null) await onRename(editingId, label);
      else await onCreate(label);
      closeEditor();
    } catch {
      // 실패 안내는 호출부 토스트가 맡고, 입력은 그대로 둔다.
    } finally {
      committingRef.current = false;
    }
  };

  const editorInput = (
    <Input
      unstyled
      autoFocus
      value={draft}
      maxLength={30}
      disabled={isSaving}
      aria-label="구분 이름"
      placeholder="구분 이름"
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeEditor();
        }
      }}
      onBlur={() => {
        if (draft.trim()) void commit();
        else closeEditor();
      }}
      className={`${vendorClasses.fieldInput} !h-9`}
    />
  );

  return (
    <aside className={vendorClasses.categories} aria-label="협력업체 구분">
      <div className={vendorClasses.categoryHeader}>
        <h2 className={vendorClasses.categoryTitle}>구분</h2>
        <button
          type="button"
          aria-label="구분 추가"
          onClick={() => {
            setEditingId(null);
            setDraft("");
            setAdding(true);
          }}
          className="ml-auto inline-flex size-7 items-center justify-center rounded-[8px] text-t3 hover:bg-bg hover:text-t1 focus-visible:bg-bg focus-visible:outline-none"
        >
          <PlusIcon className="size-[15px]" aria-hidden="true" />
        </button>
      </div>

      <ul className={vendorClasses.categoryList}>
        {/* "전체" item — single-click only, no rename */}
        <li key="__all__">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`${vendorClasses.categoryItem} ${isActive("__all__") ? vendorClasses.categoryItemActive : vendorClasses.categoryItemIdle}`}
            aria-pressed={isActive("__all__")}
          >
            <span className={vendorClasses.categoryLabel}>전체</span>
            <span className={`${vendorClasses.categoryCount} ${isActive("__all__") ? vendorClasses.categoryCountActive : vendorClasses.categoryCountIdle}`}>{allVendors.length}</span>
          </button>
        </li>

        {/* 기본 구분 9종은 고정(이름 변경·삭제 불가). 사용자 추가 구분만 이름 편집·삭제. */}
        {categories.map((c) => {
          const active = isActive(String(c.id));
          const count = countMap[c.id] ?? 0;

          if (editingId === c.id) {
            return <li key={c.id}>{editorInput}</li>;
          }

          return (
            <li key={c.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                onDoubleClick={c.isDefault ? undefined : () => startEdit(c)}
                className={`${vendorClasses.categoryItem} ${active ? vendorClasses.categoryItemActive : vendorClasses.categoryItemIdle}`}
                aria-pressed={active}
              >
                <span className={vendorClasses.categoryLabel}>{c.label}</span>
                <span className={`${vendorClasses.categoryCount} ${active ? vendorClasses.categoryCountActive : vendorClasses.categoryCountIdle}`}>{count}</span>
              </button>
              {c.isDefault ? null : (
                <>
                  <button
                    type="button"
                    aria-label={`${c.label} 이름 편집`}
                    onClick={() => startEdit(c)}
                    className="flex-none rounded-[8px] px-1.5 py-1 text-xs font-bold text-t3 hover:bg-bg hover:text-t1 focus-visible:bg-bg focus-visible:outline-none"
                  >
                    편집
                  </button>
                  <button
                    type="button"
                    aria-label={`${c.label} 삭제`}
                    disabled={isSaving}
                    onClick={() => void onDelete(c)}
                    className="flex-none rounded-[8px] p-1.5 text-t3 hover:bg-bg hover:text-red focus-visible:bg-bg focus-visible:outline-none"
                  >
                    <CloseIcon className="size-[13px]" aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          );
        })}

        {adding ? <li key="__new__">{editorInput}</li> : null}
      </ul>
    </aside>
  );
}
