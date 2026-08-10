"use client";

import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
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

  return (
    <header className="h-[62px] flex-none flex items-center gap-3 px-6 bg-white border-b border-line">
      {/* hamburger — mobile only */}
      <button
        type="button"
        onClick={onMenu}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-[11px] text-t2 hover:bg-bg transition-colors"
        aria-label="메뉴 열기"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* title */}
      <h1 className="text-[19px] font-extrabold tracking-tight text-t1 flex-1">
        {title}
      </h1>

      {/* avatar */}
      {me && (
        <div className="w-[40px] h-[40px] rounded-[11px] flex items-center justify-center bg-[#DCE3EA] text-[14px] font-bold text-t2 select-none flex-none">
          {me.fullName.charAt(0)}
        </div>
      )}
    </header>
  );
}
