"use client";

import Image from "next/image";
import { useState } from "react";

export function MessagingWorkspaceShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [minimized, setMinimized] = useState(false);

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label="문자·알림톡 발송"
      className={`fixed right-[22px] top-[95px] z-50 flex w-[min(820px,calc(100vw-44px))] flex-col overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_30px_80px_-20px_rgba(23,31,40,0.5)] transition-[height] ${
        minimized ? "h-[58px]" : "h-[calc(100dvh-117px)] max-h-[794px] min-h-[620px]"
      }`}
    >
      <header className="flex h-[57px] shrink-0 items-center gap-[9px] border-b border-line bg-white py-[13px] pl-[16px] pr-[12px]">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] bg-[#e2f5f1]">
          <Image src="/icons/overdue/message.svg" alt="" width={15} height={15} className="size-[15px]" />
        </span>
        <span className="flex flex-col">
          <strong className="text-[14px] font-extrabold leading-[17px] tracking-[-0.14px] text-t1">
            문자·알림톡 발송
          </strong>
          <span className="text-[11px] font-semibold leading-[13px] text-t3">
            화면을 보면서 발송할 수 있어요
          </span>
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setMinimized((current) => !current)}
          aria-label={minimized ? "발송창 펼치기" : "발송창 최소화"}
          className="flex size-[30px] items-center justify-center rounded-[8px] hover:bg-bg"
        >
          <Image src="/icons/overdue/minimize.svg" alt="" width={17} height={17} className="size-[17px]" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="발송창 닫기"
          className="flex size-[30px] items-center justify-center rounded-[8px] hover:bg-bg"
        >
          <Image src="/icons/overdue/close.svg" alt="" width={17} height={17} className="size-[17px]" />
        </button>
      </header>
      {!minimized && children}
    </section>
  );
}
