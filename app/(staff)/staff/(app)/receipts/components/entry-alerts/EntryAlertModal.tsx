"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

/**
 * 수납관리 진입 알림 모달의 공통 셸 (정본 `.up-modal`, 440px 폭).
 * 헤더(제목 + X) · 본문(안내문 + "알림 설정" 링크 + children 카드) · 푸터(오늘 그만보기 · 닫기).
 * 높이는 내용만큼이고 화면을 넘치면 본문만 스크롤한다(`.up-modal{max-height:calc(100vh - 48px)}`·`.up-b{overflow:auto}`).
 * [닫기]는 다음 알림으로 넘기고, X·Esc·바깥 클릭은 남은 알림까지 닫는다(정본 `#upX` → upHide).
 */
export function EntryAlertModal({
  title,
  subtitle,
  actionHref,
  actionLabel = "알림 설정 ›",
  onClose,
  onCloseAll,
  onDismissToday,
  children,
}: {
  title: string;
  subtitle: string;
  actionHref?: string;
  actionLabel?: string;
  onClose: () => void;
  onCloseAll: () => void;
  onDismissToday: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseAll();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onCloseAll]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-[24px]"
      onMouseDown={onCloseAll}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-alert-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100vh-48px)] w-full max-w-[440px] flex-col overflow-hidden rounded-[20px] bg-surface leading-[normal] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)]"
      >
        <header className="flex shrink-0 items-center gap-[10px] border-b border-line px-[22px] py-[18px]">
          <h2 id="entry-alert-title" className="text-[18px] font-extrabold text-t1">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCloseAll}
            aria-label="닫기"
            className="ml-auto flex size-[32px] items-center justify-center rounded-[9px] text-t3 transition hover:bg-bg hover:text-t2"
          >
            <CloseIcon className="size-[16px]" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-auto overflow-auto px-[22px] py-[20px]">
          <div className="mb-[14px] flex items-center gap-[10px]">
            <p className="text-[13.5px] font-semibold text-t2">{subtitle}</p>
            {actionHref && (
              <Link
                href={actionHref}
                className="ml-auto shrink-0 whitespace-nowrap text-[12.5px] font-bold text-t3 transition hover:text-t2"
              >
                {actionLabel}
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-[8px]">{children}</div>
        </div>

        <footer className="flex shrink-0 gap-[9px] border-t border-line px-[22px] pb-[18px] pt-[14px]">
          <button
            type="button"
            onClick={onDismissToday}
            className="h-[44px] flex-1 rounded-[12px] bg-bg text-[14px] font-bold text-t2 transition hover:brightness-95"
          >
            오늘 그만보기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[44px] flex-1 rounded-[12px] bg-teal text-[14px] font-bold text-white transition hover:bg-teal-d"
          >
            닫기
          </button>
        </footer>
      </section>
    </div>
  );
}
