export interface PlatformNavItem {
  label: string;
  href: string;
  description: string;
  /** 24×24 stroke SVG의 inner markup(rect/circle/path). 디자인 정본 admin/*.dc.html에서 verbatim. PlatformShell이 그대로 렌더. */
  icon: string;
}

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  {
    label: "대시보드",
    href: "/platform-admin",
    description: "HQ 핵심 지표·발송 비용",
    icon: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  },
  {
    label: "테넌트 관리",
    href: "/platform-admin/organizations",
    description: "입점 테넌트 조회",
    icon: '<path d="M4 21V6l7-3v18"/><path d="M11 10h9v11"/><path d="M15 14h1M15 17.5h1"/>',
  },
  {
    label: "포인트 관리",
    href: "/platform-admin/points",
    description: "조직별 잔액·충전",
    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10h4a1.8 1.8 0 0 1 0 3.6h-4"/>',
  },
  {
    label: "청구 관리",
    href: "/platform-admin/billing",
    description: "테넌트 발송 사용량·청구",
    icon: '<path d="M4 19h16"/><path d="M7 19V9M12 19V5M17 19v-6"/>',
  },
  {
    label: "계정·권한",
    href: "/platform-admin/accounts",
    description: "전체 계정·권한 조회",
    icon: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  },
  {
    label: "설정",
    href: "/platform-admin/settings",
    description: "HQ 발송단가·청구계좌·부가세",
    icon: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.7 15a2 2 0 0 1-1.8-2 2 2 0 0 1 2-2h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.5V4a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.3.9z"/>',
  },
];

export function isPlatformNavActive(pathname: string, href: string): boolean {
  return href === "/platform-admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function platformPageTitle(pathname: string): string {
  return PLATFORM_NAV_ITEMS.find((item) => isPlatformNavActive(pathname, item.href))?.label
    ?? "플랫폼 관리";
}
