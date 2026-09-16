"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/resident/home",
    label: "홈",
    icon: (
      <>
        <path d="M4 11l8-6 8 6" />
        <path d="M6 10v9h12v-9" />
      </>
    ),
  },
  {
    href: "/resident/bill",
    label: "관리비",
    icon: (
      <>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 12h8M9 16h5" />
      </>
    ),
  },
  {
    href: "/resident/me",
    label: "내 정보",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20c1.4-3.6 4-5.4 7-5.4s5.6 1.8 7 5.4" />
      </>
    ),
  },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="z-20 grid min-h-[68px] flex-none grid-cols-3 gap-1 border-t border-line bg-white px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2" aria-label="주요 메뉴">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            href={tab.href}
            className={`flex min-w-0 flex-col items-center justify-center gap-[3px] rounded-xl text-[11px] font-bold text-t3 no-underline hover:bg-blue-t2 hover:text-blue-d ${active ? "text-blue-d" : ""}`}
            aria-current={active ? "page" : undefined}
            key={tab.href}
          >
            <svg className="h-[22px] w-[22px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {tab.icon}
            </svg>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
