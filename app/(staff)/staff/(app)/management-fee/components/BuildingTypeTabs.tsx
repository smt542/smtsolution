"use client";
import React, { useState } from "react";
import { Tabs } from "@/components/common";
import type { BuildingType } from "@/hooks/reactquery/buildingTypes";

interface Props {
  types: BuildingType[];
  activeId: number | null;
  onChange: (id: number) => void;
  onAdd: (label: string) => void;
  onRename: (id: number, label: string) => void;
  onDelete: (id: number) => void;
}

export function BuildingTypeTabs({ types, activeId, onChange, onAdd, onRename, onDelete }: Props) {
  const [addingLabel, setAddingLabel] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);

  const tabs = types.map((t) => ({ id: String(t.id), label: t.label }));
  const active = activeId ? String(activeId) : (tabs[0]?.id ?? "");

  const handleAdd = () => setShowAddInput(true);

  const handleAddConfirm = () => {
    const label = addingLabel.trim();
    if (label) {
      onAdd(label);
    }
    setAddingLabel("");
    setShowAddInput(false);
  };

  const handleTabChange = (id: string) => onChange(Number(id));

  const handleRename = (id: string, label: string) => onRename(Number(id), label);

  const handleDelete = (id: string) => {
    if (types.length <= 1) return; // enforce min 1
    onDelete(Number(id));
  };

  return (
    <div>
      <Tabs
        tabs={tabs}
        active={active}
        onChange={handleTabChange}
        onAdd={handleAdd}
        onRename={handleRename}
        onDelete={types.length > 1 ? handleDelete : undefined}
      />
      {showAddInput && (
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <input
            autoFocus
            className="h-9 rounded-lg border border-line bg-bg px-3 text-sm text-t1 focus:border-brand focus:outline-none"
            placeholder="유형명 입력"
            value={addingLabel}
            onChange={(e) => setAddingLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddConfirm();
              if (e.key === "Escape") { setShowAddInput(false); setAddingLabel(""); }
            }}
          />
          <button
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white"
            onClick={handleAddConfirm}
          >
            추가
          </button>
          <button
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-t3"
            onClick={() => { setShowAddInput(false); setAddingLabel(""); }}
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
