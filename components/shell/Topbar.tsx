"use client";

import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
import { MenuIcon } from "@/components/icons";
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
  const { data: me } = useMe();
  const title = findPageTitle(pathname);
  const usesRouteActions = pathname.startsWith("/staff/receipts");

  return (
    <header className="h-[62px] flex-none flex items-center gap-[28px] px-6 bg-white border-b border-line">
      {/* Figma 공통 상단 메뉴 아이콘. 모바일에서는 서랍을 열고 데스크톱에서는 위치 기준을 유지한다. */}
      <button
        type="button"
        onClick={onMenu}
        className="flex h-[32px] w-[22px] shrink-0 items-center justify-center text-t3 transition-colors hover:text-t1"
        aria-label="메뉴 열기"
      >
        <MenuIcon className="size-[18px]" />
      </button>

      {/* title */}
      <h1 className="text-[19px] font-extrabold tracking-tight text-t1 flex-1">
        {title}
      </h1>

      {/* avatar */}
      {me && !usesRouteActions && (
        <div className="w-[40px] h-[40px] rounded-[11px] flex items-center justify-center bg-[#DCE3EA] text-[14px] font-bold text-t2 select-none flex-none">
          {me.fullName.charAt(0)}
        </div>
      )}
    </header>
  );
}
