"use client";
import React, { useState } from "react";

export function Tabs({
  tabs,
  active,
  onChange,
  onAdd,
  onRename,
  onDelete,
  variant = "default",
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  onAdd?: () => void;
  onRename?: (id: string, label: string) => void;
  onDelete?: (id: string) => void;
  variant?: "default" | "underline";
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (id: string, label: string) => {
    setRenamingId(id);
    setRenameValue(label);
  };

  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed && onRename) {
      onRename(id, trimmed);
    }
    setRenamingId(null);
    setRenameValue("");
  };

  if (variant === "underline") {
    return (
      <div className="flex items-center gap-[4px]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`px-[16px] py-[12px] text-[14px] font-bold leading-[normal] border-b-2 -mb-px ${
              active === t.id
                ? "border-brand text-brand"
                : "border-transparent text-t3"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 border-b border-line">
      {tabs.map((t) => (
        <div key={t.id} className="relative flex items-center">
          {renamingId === t.id ? (
            <input
              autoFocus
              aria-label="유형 이름 변경"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitRename(t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(t.id);
                if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
              }}
              className="rounded border border-brand bg-bg px-2 py-1 text-sm font-bold text-brand focus:outline-none"
            />
          ) : (
            <button
              onClick={() => onChange(t.id)}
              onDoubleClick={onRename ? () => startRename(t.id, t.label) : undefined}
              className={`px-4 py-2 text-sm font-bold ${
                active === t.id
                  ? "border-b-2 border-brand text-brand"
                  : "text-t3"
              }`}
            >
              {t.label}
            </button>
          )}
          {onDelete && (
            <button
              aria-label="유형 삭제"
              data-del-tab={t.id}
              onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
              className="ml-0.5 rounded px-1 py-0.5 text-xs text-t3 hover:text-danger"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {onAdd && (
        <button onClick={onAdd} className="px-3 py-2 text-sm text-t3">
          ＋ 유형 추가
        </button>
      )}
    </div>
  );
}
