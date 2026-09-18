"use client";
import React, { useState } from "react";

/**
 * 탭 규격.
 *
 * - `default` 기존 값. 호출부 9곳(partner 모바일·accounts·fee-items·management-fee·
 *   messaging·receipts 등)이 쓰고 그 중 여럿은 픽셀 정합이 끝난 화면이라 **건드리지 않는다.**
 * - `page`    화면 상단 페이지 탭바. Figma 노드 `72:69569` 실측
 *   (`docs/superpowers/plans/2026-09-18-setup-figma-tokens.md`).
 *   비활성에도 투명 `border-b-2`를 둬서 활성 탭만 2px 높아지는 흔들림이 없다.
 */
const TAB_SIZES = {
  default: {
    container: "",
    tab: "px-4 py-2",
    activeBorder: "border-b-2 border-brand",
    idleBorder: "",
  },
  page: {
    container: "bg-white px-[24px]",
    tab: "px-[16px] py-[12px]",
    activeBorder: "border-b-2 border-brand",
    idleBorder: "border-b-2 border-transparent",
  },
} as const;

export function Tabs({
  tabs,
  active,
  onChange,
  onAdd,
  onRename,
  onDelete,
  size = "default",
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  onAdd?: () => void;
  onRename?: (id: string, label: string) => void;
  onDelete?: (id: string) => void;
  size?: keyof typeof TAB_SIZES;
}) {
  const spec = TAB_SIZES[size];
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

  return (
    <div className={`flex items-center gap-1 border-b border-line ${spec.container}`}>
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
              className={`${spec.tab} text-sm font-bold ${
                active === t.id
                  ? `${spec.activeBorder} text-brand`
                  : `${spec.idleBorder} text-t3`
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
