"use client";

import Image from "next/image";
import { toast } from "sonner";

interface QuickAccessRailProps {
  variant?: "moving-inquiry" | "fee-items";
}

export function QuickAccessRail({ variant = "moving-inquiry" }: QuickAccessRailProps) {
  const feeItems = variant === "fee-items";
  return (
    <aside aria-label="빠른 도구" className="hidden print:hidden lg:block">
      <button
        type="button"
        aria-label="사이드 패널 열기"
        className="fixed right-0 top-1/2 z-20 flex h-[70px] w-[31px] -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-line bg-white shadow-[0_3px_18px_rgba(23,31,40,.18)]"
        onClick={() => toast.info("사이드 패널은 준비 중입니다.")}
      >
        <Image
          src="/icons/fee-items/side-panel.svg"
          alt=""
          width={feeItems ? 16 : 18}
          height={feeItems ? 16 : 18}
        />
      </button>
    </aside>
  );
}
