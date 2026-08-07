"use client";

export function Tabs({
  tabs,
  active,
  onChange,
  onAdd,
  onRename,
  onDelete,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  onAdd?: () => void;
  onRename?: (id: string, label: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-bold ${
            active === t.id
              ? "border-b-2 border-brand text-brand"
              : "text-t3"
          }`}
        >
          {t.label}
        </button>
      ))}
      {onAdd && (
        <button onClick={onAdd} className="px-3 py-2 text-sm text-t3">
          ＋ 유형 추가
        </button>
      )}
    </div>
  );
}
