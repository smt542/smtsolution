"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./BottomNav.module.css";

const tabs = [
  {
    href: "/resident/home",
    label: "홈",
    icon: (
      <path d="M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-4v6H5a1.5 1.5 0 0 1-1.5-1.5z" />
    ),
  },
  {
    href: "/resident/bill",
    label: "관리비",
    icon: (
      <>
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-4 2-4-2-3 2V4a1 1 0 0 1 1-1Z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
  },
  {
    href: "/resident/me",
    label: "내 정보",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            href={tab.href}
            className={`${styles.tab} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
            key={tab.href}
          >
            <svg
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
