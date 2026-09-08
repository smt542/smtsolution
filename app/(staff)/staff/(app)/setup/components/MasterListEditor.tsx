"use client";
import { useState } from "react";
import { Button, Input } from "@/components/common";

export interface MasterItem { id: number; label: string; }

export function MasterListEditor({
  title, items, onAdd, onRename, onDelete,
}: {
  title: string;
  items: MasterItem[];
  onAdd: (label: string) => void;
  onRename: (id: number, label: string) => void;
  onDelete: (id: number) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const add = () => {
    const v = newLabel.trim();
    if (!v) return;
    onAdd(v);
    setNewLabel("");
  };
  const saveEdit = () => {
    const v = editLabel.trim();
    if (editingId != null && v) onRename(editingId, v);
    setEditingId(null);
    setEditLabel("");
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h4 className="mb-3 text-sm font-extrabold text-t1">{title}</h4>
      <ul className="flex flex-col gap-1">
        {items.length === 0 && <li className="py-2 text-sm text-t4">등록된 항목이 없습니다.</li>}
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2">
            {editingId === it.id ? (
              <>
                <Input
                  aria-label={`${title} 이름 변경`}
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                />
                <Button variant="primary" onClick={saveEdit}>저장</Button>
                <button onClick={() => setEditingId(null)} className="text-xs text-t3">취소</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-t2">{it.label}</span>
                <button aria-label={`${it.label} 수정`} onClick={() => { setEditingId(it.id); setEditLabel(it.label); }} className="text-xs text-t3 hover:text-brand">수정</button>
                <button aria-label={`${it.label} 삭제`} onClick={() => onDelete(it.id)} className="text-xs text-t3 hover:text-danger">삭제</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <Input
          aria-label={`${title} 추가`}
          placeholder="새 항목"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        <Button variant="primary" onClick={add}>＋ 추가</Button>
      </div>
    </div>
  );
}
