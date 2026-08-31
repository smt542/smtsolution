"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLogout, useMe } from "@/hooks/reactquery/auth";
import { BrandMarkIcon } from "@/components/icons";
import { hasModule } from "@/lib/auth/permissions";
import { NAV_GROUPS, type NavItem } from "./navItems";

const PLATFORM_ADMIN_ITEM: NavItem = {
  label: "통합관리자 콘솔",
  href: "/platform-admin",
  built: true,
  icon: "M4 4h6v6H4V4zM14 4h6v6h-6V4zM4 14h6v6H4v-6zM14 14h6v6h-6v-6z",
};

const RECEIPTS_NAV_ITEMS: NavItem[] = [
  { label: "수납관리·민원접수", href: "/staff/receipts", built: true, icon: "M3 6h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18M7 15h4" },
  { label: "건물·입주자 관리", href: "/staff/buildings", built: true, icon: "M4 3h16a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 20 21H4a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 4 3zm5 5h1m5 0h1M9 12h1m5 0h1M9.5 21v-4h5v4" },
  { label: "공과금 관리", href: "/staff/utilities", built: true, icon: "M4 18a8 8 0 1 1 16 0M12 14l3.5-3.5" },
  { label: "관리비 부과 세팅", href: "/staff/management-fee", built: true, icon: "M4 8h9M18 8h2M4 16h2M11 16h9M15 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" },
  { label: "항목등록 관리", href: "/staff/fee-items", built: true, icon: "M4 6h16M4 12h10M4 18h7M17 14l2 2 4-4" },
  { label: "서류 발행·출력", href: "/staff/bill", built: true, icon: "M5 3h14a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h4" },
  { label: "미납 관리", href: "/staff/overdue", built: true, icon: "M12 3a9 9 0 1 1 0 18A9 9 0 0 1 12 3zM12 8v5M12 16h.01" },
  { label: "이사정산", href: "/staff/moving-settlement", built: true, icon: "M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8" },
  { label: "협력업체 관리", href: "/staff/vendor-management", built: true, icon: "M4 7h16v13H4V7Zm4 0V4h8v3M8 12h8" },
  { label: "장기수선비 관리", href: "/staff/long-term-repair", built: true, icon: "M4 19h16M6 16V8m4 8V5m4 11v-6m4 6V3M5 8h2m2-3h2m2 5h2m2-7h2" },
  { label: "문자·알림톡 관리", href: "/staff/messaging", built: true, icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { label: "공지 관리", href: "/staff/notices", built: true, icon: "M3 11l18-5v12L3 14v-3zM7 15v3a2 2 0 0 0 4 0v-2" },
];

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
    "flex items-center gap-[11px] px-3 py-[10px] rounded-[11px] text-[14px] transition-colors duration-100 w-full text-left";

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
          ? "bg-blue-t text-blue font-bold"
          : "text-t2 hover:bg-bg"
      }`}
    >
      <NavIcon d={item.icon} />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

/* ── sidebar ─────────────────────────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const logout = useLogout();

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

  if (pathname.startsWith("/staff/receipts")) {
    return (
      <aside className="flex h-full w-60 flex-col border-r border-line bg-white px-[14px] pb-[25px] pt-[18px]">
        <div className="flex items-center gap-[10px] px-[10px] pb-[18px] pt-2">
          <BrandMarkIcon className="size-[34px] shrink-0 text-[#16798c]" />
          <span className="text-[18px] font-extrabold tracking-[-0.5px] text-t1">
            관리<span className="text-teal">비서</span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-[2px] overflow-y-auto">
          {RECEIPTS_NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const expandable = item.href === "/staff/utilities" || item.href === "/staff/moving-settlement";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[40px] w-full items-center gap-[11px] rounded-[11px] px-[12px] text-[14px] transition-colors ${
                  active ? "bg-teal font-bold text-white" : "text-t2 hover:bg-bg"
                }`}
              >
                <NavIcon d={item.icon} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {expandable && <span className="text-[15px] leading-none opacity-70">⌄</span>}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={logout.isPending}
          className="mt-auto flex h-[47px] w-full items-center gap-[9px] rounded-[11px] bg-bg px-[18px] text-left text-[13px] font-bold text-red transition hover:bg-red-t disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-[16px]" aria-hidden="true">
            <path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5" />
          </svg>
          {logout.isPending ? "로그아웃 중" : "로그아웃"}
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-60 h-full flex flex-col bg-white border-r border-line py-[18px] px-[14px]">
      {/* Brand */}
      <div className="flex items-center gap-[10px] px-[10px] pb-[18px] pt-2">
        <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-none bg-gradient-to-br from-[#4593FC] to-[#2E7BF6]">
          {/* home icon */}
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 11l8-6 8 6" />
            <path d="M6 10v9h12v-9" />
            <path d="M10 19v-5h4v5" />
          </svg>
        </div>
        <span className="text-[18px] font-extrabold tracking-tight text-t1">
          관리<span className="text-blue">비서</span>
        </span>
      </div>

      {/* Nav groups */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {me?.role === "platform_admin" && (
          <nav className="flex flex-col gap-0.5">
            <NavItemRow
              item={PLATFORM_ADMIN_ITEM}
              active={pathname.startsWith(PLATFORM_ADMIN_ITEM.href)}
            />
          </nav>
        )}
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) =>
            item.modules
              ? item.modules.some((m) => hasModule(me ?? null, m))
              : !item.module || hasModule(me ?? null, item.module),
          );
          if (visible.length === 0) return null;

          return (
            <div key={group.label}>
              {group.label && (
                <div className="text-[11px] font-bold text-t4 tracking-[0.04em] px-3 pt-3 pb-1.5">
                  {group.label}
                </div>
              )}
              <nav className="flex flex-col gap-0.5">
                {visible.map((item) => {
                  const active =
                    item.href === "/staff" ? pathname === "/staff" : pathname.startsWith(item.href);
                  return (
                    <NavItemRow key={item.href} item={item} active={active} />
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* Sidebar footer — user info + logout */}
      {me && (
        <div className="mt-auto flex flex-col gap-1.5">
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
