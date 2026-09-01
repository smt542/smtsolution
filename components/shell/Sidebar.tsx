"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLogout, useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { OFFICE_NAV_ITEMS, type NavItem } from "./navItems";

const PLATFORM_ADMIN_ITEM: NavItem = {
  label: "통합관리자 콘솔",
  href: "/platform-admin",
  built: true,
  icon: "M4 4h6v6H4V4zM14 4h6v6h-6V4zM4 14h6v6H4v-6zM14 14h6v6h-6v-6z",
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

/* ── small icon rendered from path data ─────────────────────────────────── */
function NavIcon({ d }: { d: string }) {
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
    >
      {d.split("M").filter(Boolean).map((seg, i) => {
        const full = "M" + seg;
        // circle segments start with a different command — handle both path types
        return <path key={i} d={full} />;
      })}
    </svg>
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
    "flex h-[40px] w-full items-center gap-[11px] rounded-[11px] px-[12px] text-left text-[13.5px] leading-[17px] transition-colors duration-100";

  if (!item.built) {
    return (
      <div className={`${base} text-t3 cursor-default select-none`}>
        <NavIcon d={item.icon} />
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
          : "text-t2 hover:bg-bg"
      }`}
    >
      <NavIcon d={item.icon} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {(item.href === "/staff/utilities" || item.href === "/staff/moving-settlement") && (
        <span className="text-[15px] leading-none opacity-70" aria-hidden="true">⌄</span>
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
    `flex h-8 items-center rounded-lg px-2 text-[12.5px] ${
      isUtilitiesPage && activeType === type
        ? "bg-teal-t font-extrabold text-teal-d"
        : "font-medium text-t3 hover:bg-bg hover:text-t2"
    }`;
  const customerNumberClass = `flex h-8 items-center rounded-lg px-2 text-[12.5px] ${
    isCustomerNumbersPage
      ? "bg-teal-t font-extrabold text-teal-d"
      : "font-medium text-t3 hover:bg-bg hover:text-t2"
  }`;

  return (
    <div className="pb-1">
      <Link
        href={item.href}
        className="flex h-[40px] w-full items-center gap-[11px] rounded-[11px] px-[12px] text-[13.5px] font-bold text-t2 hover:bg-bg"
      >
        <NavIcon d={item.icon} />
        <span className="flex-1">{item.label}</span>
        <span className="rotate-180 text-[15px] leading-none text-t3" aria-hidden="true">⌄</span>
      </Link>
      <div className="ml-[31px] flex flex-col gap-0.5 border-l border-line pl-[11px]">
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
    <div className="pb-1">
      <Link
        href={item.href}
        className="flex h-[40px] w-full items-center gap-[11px] rounded-[11px] px-[12px] text-[13.5px] font-bold text-t1 hover:bg-bg"
      >
        <NavIcon d={item.icon} />
        <span className="flex-1">{item.label}</span>
        <span className="rotate-180 text-[15px] leading-none text-t3" aria-hidden="true">⌄</span>
      </Link>
      <div className="ml-[31px] flex flex-col gap-[2px] border-l border-line pl-[11px]">
        {links.map((link) => {
          const active = link.href === "/staff/moving-settlement"
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-[32px] items-center rounded-[9px] px-[12px] text-[12.5px] ${active ? "bg-teal font-bold text-white" : "font-medium text-t3 hover:bg-bg hover:text-t2"}`}
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
  const logout = useLogout();
  const [activeUtilityType, setActiveUtilityType] = useState<"electricity" | "water" | "gas">("gas");
  const isUtilitiesPage = pathname.startsWith("/staff/utilities");
  const isBillPage = pathname.startsWith("/staff/bill");
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

  return (
    <aside className="flex h-full w-60 flex-col border-r border-line bg-white px-[14px] pb-[25px] pt-[18px] font-sans">
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
        <span className="text-[18px] font-extrabold leading-[23px] tracking-[-0.5px] text-t1">
          관리<span className="text-teal">비서</span>
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
                active={pathname.startsWith(item.href)}
              />
            )
          ))}
        </nav>
      </div>

      {/* Sidebar footer — user info + logout */}
      {me && (
        <div className="mt-auto flex flex-col gap-1.5">
          {!isBillPage && (
            <div className="flex items-center gap-[10px] p-[10px] rounded-xl bg-bg">
              <div className="w-[34px] h-[34px] rounded-full bg-[#DCE3EA] flex items-center justify-center text-[14px] font-bold text-t2 flex-none select-none">
                {me.fullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-t1 truncate">{me.fullName}</div>
                <div className="text-[11px] text-t3 truncate">
                  {me.username} · {roleLabel(me.role)}
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={logout.isPending}
            className="flex w-full items-center gap-2 rounded-[11px] px-3 py-2.5 text-left text-[13px] font-bold text-red transition-colors hover:bg-red-t disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 flex-none" aria-hidden="true">
              <path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5" />
            </svg>
            {logout.isPending ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
      )}
    </aside>
  );
}
