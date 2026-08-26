"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLogout, useMe } from "@/hooks/reactquery/auth";
import {
  PLATFORM_NAV_ITEMS,
  isPlatformNavActive,
  platformPageTitle,
  type PlatformNavItem,
} from "../navItems";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      <div className="sticky top-0 hidden h-screen md:flex">
        <PlatformSidebar pathname={pathname} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <PlatformTopbar
          title={platformPageTitle(pathname)}
          onMenu={() => setDrawerOpen(true)}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {drawerOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-label="메뉴 닫기"
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <PlatformSidebar pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

function PlatformSidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { data: me } = useMe();
  const router = useRouter();
  const logout = useLogout();

  const handleLogout = async () => {
    if (logout.isPending) return;

    try {
      await logout.mutateAsync();
      onNavigate?.();
      router.replace("/platform-admin/login");
      router.refresh();
    } catch {
      toast.error("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-line bg-[#101828] px-3.5 py-[18px] text-white">
      <div className="px-2.5 pb-5 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-gradient-to-br from-[#66A3FF] to-[#3182F6]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path d="M4 11l8-6 8 6M6 10v9h12v-9M10 19v-5h4v5" />
            </svg>
          </div>
          <div>
            <div className="text-[17px] font-extrabold tracking-tight">관리비서</div>
            <div className="mt-0.5 text-[10px] font-bold tracking-[0.14em] text-[#98A2B3]">PLATFORM ADMIN</div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 text-[10px] font-bold tracking-[0.12em] text-[#667085]">PLATFORM</div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="플랫폼 관리 메뉴">
        {PLATFORM_NAV_ITEMS.map((item) => (
          <PlatformNavLink
            key={item.href}
            item={item}
            active={isPlatformNavActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <Link
        href="/staff"
        onClick={onNavigate}
        className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-[#D0D5DD] hover:bg-white/5"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
          <path d="M19 12H5m6-6-6 6 6 6" />
        </svg>
        직원 운영 화면
      </Link>

      {me && (
        <details className="group relative">
          <summary
            className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl bg-white/[0.06] p-2.5 transition-colors hover:bg-white/[0.1] [&::-webkit-details-marker]:hidden"
            aria-label="프로필 메뉴"
          >
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#344054] text-sm font-bold">
              {me.fullName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">{me.fullName}</div>
              <div className="truncate text-[11px] text-[#98A2B3]">
                {me.role === "platform_admin" ? "플랫폼 관리자" : "조직 소유자"}
              </div>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 flex-none text-[#98A2B3] transition-transform group-open:rotate-180"
              aria-hidden="true"
            >
              <path d="M6 15l6-6 6 6" />
            </svg>
          </summary>
          <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-xl border border-line bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.4)]">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={logout.isPending}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold text-red transition-colors hover:bg-red-t disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                <path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5" />
              </svg>
              {logout.isPending ? "로그아웃 중…" : "로그아웃"}
            </button>
          </div>
        </details>
      )}
    </aside>
  );
}

function PlatformNavLink({
  item,
  active,
  onNavigate,
}: {
  item: PlatformNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
        active ? "bg-blue text-white shadow-sm" : "text-[#D0D5DD] hover:bg-white/[0.06]"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 flex-none" aria-hidden="true">
        <path d={item.icon} />
      </svg>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{item.label}</span>
        <span className={`mt-0.5 block truncate text-[10px] ${active ? "text-white/70" : "text-[#667085]"}`}>
          {item.description}
        </span>
      </span>
    </Link>
  );
}

function PlatformTopbar({ title, onMenu }: { title: string; onMenu: () => void }) {
  const { data: me } = useMe();

  return (
    <header className="flex h-[62px] flex-none items-center gap-3 border-b border-line bg-white px-5 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-t2 hover:bg-bg md:hidden"
        aria-label="메뉴 열기"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
      <h1 className="flex-1 text-[19px] font-extrabold tracking-tight text-t1">{title}</h1>
      {me && (
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-full bg-blue-t px-2.5 py-1 text-[11px] font-bold text-blue">
            MASTER
          </span>
          <span className="text-sm font-semibold text-t2">{me.fullName}</span>
        </div>
      )}
    </header>
  );
}
