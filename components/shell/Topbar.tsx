"use client";

import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "./navItems";

interface TopbarProps {
  onMenu: () => void;
}

function findPageTitle(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const match =
        item.href === "/staff" ? pathname === "/staff" : pathname.startsWith(item.href);
      if (match) return item.label;
    }
  }
  return "관리비서";
}

export function Topbar({ onMenu }: TopbarProps) {
  const pathname = usePathname();
  const title = findPageTitle(pathname);
  const isMovingInquiry = pathname.startsWith("/staff/moving-settlement/inquiries/");
  const isMovingSettlement = pathname === "/staff/moving-settlement";

  return (
    <header className="h-[62px] flex-none flex items-center gap-[12px] px-6 bg-white border-b border-line">
      {/* 캔버스 hf-top lnb-btn: 36×36 rounded, hover 배경 채움 */}
      <button
        type="button"
        onClick={onMenu}
        className="mr-[2px] flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] text-t2 transition-colors hover:bg-bg"
        aria-label="메뉴 열기"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[20px] w-[20px]" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isMovingInquiry || isMovingSettlement ? (
        <div className="min-w-0 flex-1 leading-none">
          <p className={`${isMovingInquiry ? "text-[12px] leading-[15px]" : "text-[10px] leading-[12px]"} font-semibold text-t3`}>
            이사정산
          </p>
          <h1 className={`${isMovingInquiry ? "text-[19px] leading-[23px]" : "text-[17px] leading-[21px]"} mt-[3px] font-extrabold tracking-[-0.35px] text-t1`}>
            {isMovingInquiry
              ? pathname.endsWith("/all")
                ? "전체 이사조회"
                : pathname.endsWith("/electric")
                  ? "전기 이사조회"
                  : pathname.endsWith("/water")
                    ? "수도 이사조회"
                    : "가스 이사조회"
              : "이사정산 입력"}
          </h1>
        </div>
      ) : (
        <h1 className="flex-1 text-[19px] font-extrabold tracking-[-0.02em] text-t1">
          {title}
        </h1>
      )}
    </header>
  );
}
