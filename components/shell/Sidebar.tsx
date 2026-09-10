"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLogout, useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { hasModule } from "@/lib/auth/permissions";
import { OFFICE_NAV_ITEMS, type NavItem } from "./navItems";

const PLATFORM_ADMIN_ITEM: NavItem = {
  label: "통합관리자 콘솔",
  href: "/platform-admin",
  built: true,
  icon: '<path d="M4 4h6v6H4V4zM14 4h6v6h-6V4zM4 14h6v6H4v-6zM14 14h6v6h-6v-6z"/>',
};

/* ── role label ─────────────────────────────────────────────────────────── */
function roleLabel(role: string): string {
  switch (role) {
    case "org_owner": return "마스터";
    case "manager":   return "관리자";
    case "field":     return "현장";
    default:          return "직원";
  }
}

/* ── small icon: 디자인 정본 .dc.html의 SVG inner markup을 그대로 렌더 ───────── */
function NavIcon({ svg }: { svg: string }) {
  // svg = 디자인 정본 .dc.html의 신뢰된 정적 마크업(rect/circle/path)만 담긴다 — 사용자 입력 아님.
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/* ── a single nav item ───────────────────────────────────────────────────── */
function NavItemRow({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const base =
    "flex h-[40px] w-full items-center gap-[11px] rounded-[11px] px-[12px] text-left text-[14px] leading-[17px] transition-colors duration-100";

  if (!item.built) {
    return (
      <div className={`${base} text-t3 font-semibold cursor-default select-none`}>
        <NavIcon svg={item.icon} />
        <span className="flex-1">{item.label}</span>
        <span className="text-[10px] font-bold text-t4 bg-line px-1.5 py-0.5 rounded-md leading-none">
          준비중
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${base} ${
        active
          ? "bg-teal font-bold text-white"
          : "text-t2 font-semibold hover:bg-bg"
      }`}
    >
      <NavIcon svg={item.icon} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {(item.href === "/staff/utilities" || item.href === "/staff/moving-settlement") && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-[14px] w-[14px] text-t3" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      )}
    </Link>
  );
}

function UtilitiesNavGroup({
  item,
  activeType,
  isUtilitiesPage,
  isCustomerNumbersPage,
  onSelect,
}: {
  item: NavItem;
  activeType: "electricity" | "water" | "gas";
  isUtilitiesPage: boolean;
  isCustomerNumbersPage: boolean;
  onSelect: (type: "electricity" | "water" | "gas") => void;
}) {
  const linkClass = (type: "electricity" | "water" | "gas") =>
    `flex h-8 items-center rounded-[9px] px-3 text-[13.5px] ${
      isUtilitiesPage && activeType === type
        ? "bg-teal font-bold text-white"
        : "font-semibold text-t2 hover:bg-bg"
    }`;
  const customerNumberClass = `flex h-8 items-center rounded-[9px] px-3 text-[13.5px] ${
    isCustomerNumbersPage
      ? "bg-teal font-bold text-white"
      : "font-semibold text-t2 hover:bg-bg"
  }`;

  return (
    <div>
      <Link
        href={item.href}
        className="flex h-[40px] w-full items-center gap-[11px] rounded-[11px] px-[12px] text-[14px] font-semibold text-t1 hover:bg-bg"
      >
        <NavIcon svg={item.icon} />
        <span className="flex-1">{item.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-[14px] w-[14px] rotate-180 text-t3" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </Link>
      <div className="my-[2px] ml-[16px] flex flex-col gap-[2px] border-l border-line pl-[14px]">
        <Link
          href="/staff/customer-numbers"
          aria-current={isCustomerNumbersPage ? "page" : undefined}
          className={customerNumberClass}
        >
          고객번호 조회
        </Link>
        <Link href="/staff/utilities?type=electricity" onClick={() => onSelect("electricity")} aria-current={isUtilitiesPage && activeType === "electricity" ? "page" : undefined} className={linkClass("electricity")}>전기</Link>
        <Link href="/staff/utilities?type=water" onClick={() => onSelect("water")} aria-current={isUtilitiesPage && activeType === "water" ? "page" : undefined} className={linkClass("water")}>수도</Link>
        <Link href="/staff/utilities" onClick={() => onSelect("gas")} aria-current={isUtilitiesPage && activeType === "gas" ? "page" : undefined} className={linkClass("gas")}>가스</Link>
      </div>
    </div>
  );
}

function MovingSettlementNavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const links = [
    { label: "이사정산 입력", href: "/staff/moving-settlement" },
    { label: "전체 이사조회", href: "/staff/moving-settlement/inquiries/all" },
    { label: "전기 이사조회", href: "/staff/moving-settlement/inquiries/electric" },
    { label: "수도 이사조회", href: "/staff/moving-settlement/inquiries/water" },
    { label: "가스 이사조회", href: "/staff/moving-settlement/inquiries/gas" },
  ];

  return (
    <div>
      <Link
        href={item.href}
        className="flex h-[40px] w-full items-center gap-[11px] rounded-[11px] px-[12px] text-[14px] font-semibold text-t1 hover:bg-bg"
      >
        <NavIcon svg={item.icon} />
        <span className="flex-1">{item.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-[14px] w-[14px] rotate-180 text-t3" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </Link>
      <div className="my-[2px] ml-[16px] flex flex-col gap-[2px] border-l border-line pl-[14px]">
        {links.map((link) => {
          const active = link.href === "/staff/moving-settlement"
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-[32px] items-center rounded-[9px] px-[12px] text-[13.5px] ${active ? "bg-teal font-bold text-white" : "font-semibold text-t2 hover:bg-bg"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── sidebar ─────────────────────────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: setupConfig } = useSetupConfig(me?.orgId);
  const logout = useLogout();
  const [activeUtilityType, setActiveUtilityType] = useState<"electricity" | "water" | "gas">("gas");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const isUtilitiesPage = pathname.startsWith("/staff/utilities");
  const isMovingInquiryPage = pathname.startsWith("/staff/moving-settlement/inquiries/");
  const isCustomerNumbersPage = pathname.startsWith("/staff/customer-numbers");
  const isUtilitiesSection = isUtilitiesPage || isCustomerNumbersPage;
  const isMovingSettlementSection = pathname.startsWith("/staff/moving-settlement");
  const visibleItems = OFFICE_NAV_ITEMS.filter((item) =>
    item.modules
      ? item.modules.some((module) => hasModule(me ?? null, module))
      : !item.module || hasModule(me ?? null, item.module),
  );

  const handleLogout = async () => {
    if (logout.isPending) return;
    try {
      await logout.mutateAsync();
      router.replace("/staff/login");
      router.refresh();
    } catch {
      toast.error("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const selectUtilityType = (type: "electricity" | "water" | "gas") => {
    setActiveUtilityType(type);
    window.dispatchEvent(new CustomEvent("utilities:type-change", { detail: type }));
  };

  useEffect(() => {
    if (!pathname.startsWith("/staff/utilities")) return;
    const initialSync = window.setTimeout(() => {
      const type = new URLSearchParams(window.location.search).get("type");
      selectUtilityType(type === "electricity" ? "electricity" : type === "water" ? "water" : "gas");
    }, 0);
    return () => window.clearTimeout(initialSync);
  }, [pathname]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileMenuOpen]);

  return (
    <aside className="flex h-full w-60 flex-col border-r border-line bg-white px-[14px] pb-[18px] pt-[18px] font-sans">
      {/* Brand */}
      <Link href="/staff" className="flex items-center gap-[10px] px-[10px] pb-[18px] pt-[8px]">
        <Image
          src="/logo-mark.png"
          alt=""
          width={34}
          height={34}
          className="size-[34px] shrink-0 object-contain"
          priority
        />
        <span className="text-[19px] font-extrabold leading-[23px] tracking-[-0.02em] text-[#16375a]">
          관리<span className="text-[#17a493]">비서</span>
        </span>
      </Link>

      {/* Figma flat navigation */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {me?.role === "platform_admin" && (
          <nav className="flex flex-col gap-[2px]">
            <NavItemRow
              item={PLATFORM_ADMIN_ITEM}
              active={pathname.startsWith(PLATFORM_ADMIN_ITEM.href)}
            />
          </nav>
        )}
        <nav className="flex flex-col gap-[2px]">
          {visibleItems.map((item) => (
            item.href === "/staff/utilities" && isUtilitiesSection ? (
              <UtilitiesNavGroup
                key={item.href}
                item={item}
                activeType={activeUtilityType}
                isUtilitiesPage={isUtilitiesPage}
                isCustomerNumbersPage={isCustomerNumbersPage}
                onSelect={selectUtilityType}
              />
            ) : item.href === "/staff/moving-settlement" && isMovingSettlementSection ? (
              <MovingSettlementNavGroup key={item.href} item={item} pathname={pathname} />
            ) : (
              <NavItemRow
                key={item.href}
                item={item}
                active={
                  pathname.startsWith(item.href) &&
                  !(isMovingInquiryPage && item.href === "/staff/moving-settlement")
                }
              />
            )
          ))}
        </nav>
      </div>

      {/* Sidebar footer — 프로필 메뉴(로그아웃은 이 메뉴 안). 캔버스 hf-side-foot: 프로필 클릭 → 메뉴 */}
      {me && (
        <div className="relative mt-auto" ref={profileMenuRef}>
          {profileMenuOpen && (
            <div
              role="menu"
              className="absolute inset-x-0 bottom-full mb-2 rounded-[14px] border border-line bg-surface p-1.5 leading-[normal] shadow-pop"
            >
              {/* 캔버스 hf-menu-head: 사용자 정보 */}
              <div className="flex items-center gap-[10px] px-3 pb-2 pt-2.5">
                <div className="flex h-[30px] w-[30px] flex-none select-none items-center justify-center rounded-full bg-[#DCE3EA] text-[12px] font-bold text-t2">
                  {me.fullName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-t1">{me.fullName}</div>
                  <div className="truncate text-[11px] font-semibold text-t3">프로필{setupConfig?.companyName ? " · " + setupConfig.companyName : ""}</div>
                </div>
              </div>
              <div className="mx-1 my-1.5 h-px bg-line2" />
              {/* 캔버스 hf-menu: 설정 섹션(계정·직원 / 셋업) — 권한 있는 항목만 노출 */}
              {(hasModule(me, "accounts") || hasModule(me, "settings")) && (
                <>
                  <div className="px-3 pb-1 pt-2 text-[11px] font-bold tracking-[0.04em] text-t4">설정</div>
                  {hasModule(me, "accounts") && (
                    <Link
                      role="menuitem"
                      href="/staff/accounts"
                      onClick={() => setProfileMenuOpen(false)}
                      className="block rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold text-t2 transition-colors hover:bg-bg"
                    >
                      계정·직원
                    </Link>
                  )}
                  {hasModule(me, "settings") && (
                    <Link
                      role="menuitem"
                      href="/staff/setup"
                      onClick={() => setProfileMenuOpen(false)}
                      className="block rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold text-t2 transition-colors hover:bg-bg"
                    >
                      셋업 설정
                    </Link>
                  )}
                  <div className="mx-1 my-1.5 h-px bg-line2" />
                </>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => { setProfileMenuOpen(false); void handleLogout(); }}
                disabled={logout.isPending}
                className="block w-full rounded-[9px] px-3 py-2.5 text-left text-[13.5px] font-semibold text-red transition-colors hover:bg-red-t disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logout.isPending ? "로그아웃 중…" : "로그아웃"}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setProfileMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            className={`flex w-full items-center gap-[10px] rounded-xl p-[10px] text-left leading-[normal] transition-colors ${profileMenuOpen ? "bg-teal-t" : "bg-transparent hover:bg-bg"}`}
          >
            <div className="w-[34px] h-[34px] rounded-full bg-[#DCE3EA] flex items-center justify-center text-[14px] font-bold text-t2 flex-none select-none">
              {me.fullName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-t1 truncate">{me.fullName}</div>
              <div className="text-[11px] text-t3 truncate">
                {roleLabel(me.role)}
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-none text-t3" aria-hidden="true">
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}
