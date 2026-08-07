"use client";

export function SidebarList({
  items,
  active,
  onSelect,
}: {
  items: { id: string; label: string; count?: number }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id}>
          <button
            onClick={() => onSelect(item.id)}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              active === item.id
                ? "bg-brand text-white"
                : "text-t2 hover:bg-bg"
            }`}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={`text-xs ${
                  active === item.id ? "text-white/80" : "text-t4"
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
