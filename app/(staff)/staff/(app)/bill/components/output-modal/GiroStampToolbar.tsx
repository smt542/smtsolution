"use client";

import type { GiroStampOptions } from "../GiroPrintView";

export type GiroStampKind = "reissue" | "waterCutoff" | "autoDebit";
export type GiroStampScope = "individual" | "all";

interface GiroStampToolbarProps {
  stamps: Pick<GiroStampOptions, "reissue" | "autoDebit"> & { waterCutoff: boolean };
  scope: GiroStampScope;
  disabled: boolean;
  onToggleStamp: (kind: GiroStampKind) => void;
  onScopeChange: (scope: GiroStampScope) => void;
}

const stampItems: { key: GiroStampKind; label: string }[] = [
  { key: "reissue", label: "재발행" },
  { key: "waterCutoff", label: "단수" },
  { key: "autoDebit", label: "자동이체" },
];

export function GiroStampToolbar({ stamps, scope, disabled, onToggleStamp, onScopeChange }: GiroStampToolbarProps) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-[8px] border-b border-[#e8ebee] bg-white px-[12px]">
      <div aria-label="지로 출력 표기" className="flex h-[32px] overflow-hidden rounded-[9px] border border-[#e8ebee] bg-white">
        {stampItems.map(({ key, label }) => {
          const active = stamps[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onToggleStamp(key)}
              className={`h-full min-w-[58px] border-r border-[#e8ebee] px-[11px] text-[10.5px] font-semibold transition last:border-r-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b7ebe4] ${active ? "bg-[#e2f5f1] text-[#0f857a]" : "text-[#8b95a1] hover:bg-[#f8f9fa]"} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div aria-label="표기 적용 범위" className="flex h-[32px] overflow-hidden rounded-[9px] border border-[#e8ebee] bg-[#edf0f3] p-[2px]">
        {(["individual", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => onScopeChange(value)}
            className={`h-[26px] rounded-[7px] px-[10px] text-[10.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b7ebe4] ${scope === value ? "bg-white text-[#333d4b] shadow-sm" : "text-[#8b95a1] hover:text-[#4e5968]"}`}
          >
            {value === "individual" ? "개별" : "전체"}
          </button>
        ))}
      </div>
    </div>
  );
}
