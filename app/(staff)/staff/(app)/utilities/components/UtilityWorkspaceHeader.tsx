"use client";

import { PrinterIcon } from "@/components/icons";

interface UtilityWorkspaceHeaderProps {
  utilityLabel: string;
  onOpenLedger: () => void;
  onOpenCarryOver: () => void;
}

export function UtilityWorkspaceHeader({
  utilityLabel,
  onOpenLedger,
  onOpenCarryOver,
}: UtilityWorkspaceHeaderProps) {
  return (
    <header className="flex h-[62px] shrink-0 items-center gap-3 border-b border-line bg-white px-6">
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => window.dispatchEvent(new Event("app-shell:open-menu"))}
        className="mr-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] text-t2 transition-colors hover:bg-bg"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="min-w-0 leading-none">
        <p className="whitespace-nowrap text-xs font-semibold text-t3">공과금 관리</p>
        <h1 className="mt-1 whitespace-nowrap text-[19px] font-extrabold tracking-[-0.02em] text-t1">
          {utilityLabel}
        </h1>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenLedger}
          className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[11px] border border-line bg-white px-[15px] text-[13.5px] font-bold text-t2 transition-colors hover:bg-bg"
        >
          <PrinterIcon className="size-4" />
          검침대장 출력
        </button>
        <button
          type="button"
          onClick={onOpenCarryOver}
          className="h-10 whitespace-nowrap rounded-[11px] bg-blue px-[15px] text-[13.5px] font-bold text-white transition-colors hover:bg-blue-d"
        >
          전체 이월
        </button>
      </div>
    </header>
  );
}
