"use client";

import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Badge, IconButton } from "@/components/common";
import { useLogout, useMe } from "@/hooks/reactquery/auth";
import {
  PLATFORM_NAV_ITEMS,
  isPlatformNavActive,
  platformPageTitle,
  type PlatformNavItem,
} from "../navItems";

// 정본 hf-top: 제목은 셸 상단바에만 두고, 페이지별 액션은 상단바 우측 슬롯에 렌더한다.
const TopBarSlotContext = createContext<HTMLElement | null>(null);

/**
 * 페이지가 셸 상단바(hf-top) 우측에 액션 버튼(입점·저장·기간선택 등)을 렌더링할 때 사용.
 * 본문에 별도 PageHeader를 두지 않고 정본처럼 상단바로 액션을 올린다.
 */
export function PlatformTopBarActions({ children }: { children: React.ReactNode }) {
  const slot = useContext(TopBarSlotContext);
  if (!slot) return null;
  return createPortal(children, slot);
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);

  return (
    <div className="flex min-h-screen bg-bg">
      <div
        className={`sticky top-0 hidden h-screen shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] md:flex ${
          collapsed ? "md:w-0" : "md:w-64"
        }`}
      >
        <PlatformSidebar pathname={pathname} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <PlatformTopbar
          title={platformPageTitle(pathname)}
          onMenu={() => setDrawerOpen(true)}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          slotRef={setSlotEl}
        />
        <TopBarSlotContext.Provider value={slotEl}>
          <main className="flex-1 overflow-auto">{children}</main>
        </TopBarSlotContext.Provider>
      </div>

      {drawerOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-scrim md:hidden"
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
    <aside className="flex h-full w-64 flex-col border-r border-line bg-white px-3.5 py-[18px]">
      {/* 캔버스 hf-hqb: 로고마크 + 관리비서 / HQ CONSOLE (라이트) */}
      <div className="flex items-center gap-2.5 px-2.5 pb-[18px] pt-2">
        <Image
          src="/logo-mark.png"
          alt=""
          width={28}
          height={28}
          className="size-[28px] flex-none object-contain"
          priority
        />
        <div className="leading-[1.15]">
          <div className="text-[17px] font-extrabold tracking-[-0.02em] text-[#16375A]">관리비서</div>
          <div className="mt-0.5 text-[10.5px] font-bold tracking-[0.08em] text-t4">HQ CONSOLE</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-[2px] overflow-y-auto" aria-label="플랫폼 관리 메뉴">
        {PLATFORM_NAV_ITEMS.map((item) => (
          <PlatformNavLink
            key={item.href}
            item={item}
            active={isPlatformNavActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {me && (
        <details className="group relative">
          <summary
            className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl bg-bg p-2.5 transition-colors hover:bg-line2 [&::-webkit-details-marker]:hidden"
            aria-label="프로필 메뉴"
          >
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#DCE3EA] text-sm font-bold text-t2">
              {me.fullName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-t1">{me.fullName}</div>
              <div className="truncate text-[11px] text-t3">
                {me.role === "platform_admin" ? "플랫폼 관리자" : "조직 소유자"}
              </div>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 flex-none text-t3 transition-transform group-open:rotate-180"
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
      className={`flex items-center gap-[11px] rounded-[11px] px-3 py-[10px] text-[14px] transition-colors ${
        active ? "bg-teal font-bold text-white" : "font-semibold text-t2 hover:bg-bg"
      }`}
    >
      {/* item.icon = 디자인 정본 admin/*.dc.html의 신뢰된 정적 SVG 마크업 */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 flex-none"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: item.icon }}
      />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

function PlatformTopbar({
  title,
  onMenu,
  onToggleCollapse,
  slotRef,
}: {
  title: string;
  onMenu: () => void;
  onToggleCollapse: () => void;
  slotRef: (el: HTMLElement | null) => void;
}) {
  const { data: me } = useMe();

  return (
    <header className="flex h-[62px] flex-none items-center gap-3 border-b border-line bg-white px-5 sm:px-6">
      {/* 모바일: 사이드 드로어 열기 */}
      <IconButton
        onClick={onMenu}
        className="h-9 w-9 rounded-xl text-t2 hover:bg-bg md:hidden"
        aria-label="메뉴 열기"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </IconButton>
      {/* 데스크톱: 사이드바 접기/펼치기 (정본 lnb-btn) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden h-9 w-9 items-center justify-center rounded-xl text-t2 hover:bg-bg md:flex"
        aria-label="사이드바 접기·펼치기"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
      <h1 className="min-w-0 flex-1 truncate text-[19px] font-extrabold tracking-tight text-t1">{title}</h1>
      {/* 페이지 액션 슬롯 (PlatformTopBarActions가 여기로 포털) */}
      <div ref={slotRef} className="flex items-center gap-2" />
      {me && (
        <div className="hidden items-center gap-2 sm:flex">
          <Badge tone="blue" className="inline-flex px-[9px] py-[3px] leading-[1.4]">
            MASTER
          </Badge>
          <span className="text-sm font-semibold text-t2">{me.fullName}</span>
        </div>
      )}
    </header>
  );
}
