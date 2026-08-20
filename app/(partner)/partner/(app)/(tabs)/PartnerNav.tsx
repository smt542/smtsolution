"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./_tabs.module.css";

const TABS = [
  {
    href: "/partner/mobile-home",
    label: "홈",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
        <path d="M4 11l8-6 8 6" />
        <path d="M6 10v9h12v-9" />
      </svg>
    ),
  },
  {
    href: "/partner/mobile-inquiry",
    label: "조회",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" />
      </svg>
    ),
  },
  {
    href: "/partner/mobile-profile",
    label: "프로필",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20c1.4-3.6 4-5.4 7-5.4s5.6 1.8 7 5.4" />
      </svg>
    ),
  },
];

export function PartnerNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={styles.navItem}
            style={{ color: active ? "var(--blue)" : "var(--t4)" }}
          >
            {t.icon}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
