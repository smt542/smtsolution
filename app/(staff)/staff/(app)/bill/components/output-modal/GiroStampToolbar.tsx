"use client";

export type GiroStampKind = "reissue" | "waterCutoff" | "autoDebit";
export type GiroStampScope = "individual" | "all";

interface GiroStampToolbarProps {
  stamps: Record<GiroStampKind, boolean>;
  scope: GiroStampScope;
  /** 늘 켜져 있어 끌 수 없는 표기. 단수 예고 대상 세대의 '단수'가 그렇다. */
  lockedKinds?: GiroStampKind[];
  onToggleStamp: (kind: GiroStampKind) => void;
  onScopeChange: (scope: GiroStampScope) => void;
}

const stampItems: { key: GiroStampKind; label: string }[] = [
  { key: "reissue", label: "재발행" },
  { key: "waterCutoff", label: "단수" },
  { key: "autoDebit", label: "자동이체" },
];

// 정본 `.giro-stamps a`·`.giro-scope a`: 11.5px/700·padding 5px 10px·모서리 7. 정본에 hover 효과는 없다.
const SEGMENT =
  "cursor-pointer whitespace-nowrap rounded-[7px] px-2.5 py-[5px] text-[11.5px] font-bold leading-[normal] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b7ebe4]";

/** 정본 `.giro-bar`: 스탬프 유형(흰 칸·켜지면 청록 틴트) + 적용 범위 스위치(회색 칸·켜지면 흰 칩). */
export function GiroStampToolbar({ stamps, scope, lockedKinds = [], onToggleStamp, onScopeChange }: GiroStampToolbarProps) {
  return (
    <div className="flex flex-none items-center gap-[7px] whitespace-nowrap border-b border-line bg-white px-3 py-[9px]">
      <div aria-label="지로 출력 표기" className="inline-flex gap-[3px] rounded-[9px] border border-line bg-white p-[3px]">
        {stampItems.map(({ key, label }) => {
          const active = stamps[key];
          const locked = lockedKinds.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              disabled={locked}
              title={locked ? "단수 예고 대상 세대라 항상 표기됩니다" : undefined}
              onClick={() => onToggleStamp(key)}
              className={`${SEGMENT} disabled:cursor-default ${active ? "bg-blue-t text-blue-d" : "text-t3"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div aria-label="표기 적용 범위" className="inline-flex gap-[2px] rounded-[9px] bg-[#EDF0F3] p-[3px]">
        {(["individual", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => onScopeChange(value)}
            className={`${SEGMENT} ${scope === value ? "bg-white text-t1 shadow-[0_2px_5px_rgba(23,31,40,0.1)]" : "text-t3"}`}
          >
            {value === "individual" ? "개별" : "전체"}
          </button>
        ))}
      </div>
    </div>
  );
}
