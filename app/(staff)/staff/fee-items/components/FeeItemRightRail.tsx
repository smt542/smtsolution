"use client";

import Image from "next/image";
import { toast } from "sonner";

export function FeeItemRightRail() {
  return (
    <aside aria-label="빠른 도구" className="hidden lg:block">
      <button
        type="button"
        aria-label="사이드 패널 열기"
        className="fixed right-0 top-1/2 z-20 flex h-[70px] w-[31px] -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-line bg-white shadow-[0_3px_18px_rgba(23,31,40,.18)]"
        onClick={() => toast.info("사이드 패널은 준비 중입니다.")}
      >
        <Image src="/icons/fee-items/side-panel.svg" alt="" width={16} height={16} />
      </button>
      <button
        type="button"
        aria-label="도움말 열기"
        className="fixed bottom-8 right-6 z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-teal shadow-[0_12px_24px_-7px_rgba(20,164,151,.65)]"
        onClick={() => toast.info("도움말 채팅은 준비 중입니다.")}
      >
        <Image src="/icons/fee-items/chat.svg" alt="" width={22} height={22} />
      </button>
    </aside>
  );
}
