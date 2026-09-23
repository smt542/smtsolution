"use client";

import { PrinterIcon } from "@/components/icons";
import { Button, IconButton } from "@/components/common";

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
      <IconButton
        aria-label="메뉴 열기"
        onClick={() => window.dispatchEvent(new Event("app-shell:open-menu"))}
        className="mr-0.5 size-9 shrink-0 rounded-[10px] text-t2 transition-colors hover:bg-bg"
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
      </IconButton>

      <div className="min-w-0">
        <p className="whitespace-nowrap text-xs font-semibold leading-[normal] text-t3">공과금 관리</p>
        <h1 className="whitespace-nowrap text-[19px] font-extrabold leading-[normal] tracking-[-0.02em] text-t1">
          {utilityLabel}
        </h1>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={onOpenLedger}
          className="transition-colors"
        >
          <PrinterIcon className="size-4" />
          검침대장 출력
        </Button>
        <Button
          variant="primary"
          type="button"
          onClick={onOpenCarryOver}
          className="shadow-none transition-colors"
        >
          전체 이월
        </Button>
      </div>
    </header>
  );
}
