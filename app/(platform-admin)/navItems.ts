export interface PlatformNavItem {
  label: string;
  href: string;
  description: string;
  icon: string;
}

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  {
    label: "플랫폼 현황",
    href: "/platform-admin",
    description: "조직·계정·건물 요약",
    icon: "M4 13h6V4H4v9zm10 7h6V11h-6v9zM4 20h6v-3H4v3zm10-13h6V4h-6v3z",
  },
  {
    label: "조직 관리",
    href: "/platform-admin/organizations",
    description: "입점 조직 조회",
    icon: "M3 21h18M5 21V7l7-4 7 4v14M9 10h2m2 0h2m-6 4h2m2 0h2m-6 4h6",
  },
  {
    label: "계정 관리",
    href: "/platform-admin/accounts",
    description: "전체 소속 계정 조회",
    icon: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0",
  },
  {
    label: "포인트 관리",
    href: "/platform-admin/points",
    description: "조직별 잔액·충전",
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 8h4a2 2 0 0 1 0 4H9V8zm0 4h5a2 2 0 0 1 0 4H9v-4z",
  },
  {
    label: "청구 관리",
    href: "/platform-admin/billing",
    description: "포인트 충전 결제 내역",
    icon: "M3 6h18v12H3V6zm0 4h18M7 15h4",
  },
  {
    label: "설정",
    href: "/platform-admin/settings",
    description: "HQ 발송단가·청구계좌·부가세",
    icon: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0-5.5 1 2.2 2.4.7 2.1-1.1 1.7 1.7-1.1 2.1.7 2.4L21 12l-2.2 1-.7 2.4 1.1 2.1-1.7 1.7-2.1-1.1-2.4.7L12 21l-1-2.2-2.4-.7-2.1 1.1-1.7-1.7 1.1-2.1L5.2 13 3 12l2.2-1 .7-2.4-1.1-2.1 1.7-1.7 2.1 1.1 2.4-.7L12 3z",
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
