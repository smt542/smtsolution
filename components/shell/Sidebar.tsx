"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { NAV_GROUPS, type NavItem } from "./navItems";

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
  const { data: me } = useMe();

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

      {/* Sidebar footer — user info */}
      {me && (
        <div className="mt-auto flex items-center gap-[10px] p-[10px] rounded-xl bg-bg">
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
    </aside>
  );
}
