"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessengerFab } from "@/components/messenger/MessengerFab";
import { AsReceptionRail } from "./as-rail/AsReceptionRail";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  children: React.ReactNode;
}

/** Paths that render bare (no shell). */
function isBare(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/staff/login") || pathname === "/staff/change-password";
}

/** Figma 자체 62px 헤더를 렌더하는 화면. */
function hasIntegratedHeader(pathname: string): boolean {
  return (
    pathname === "/staff/buildings" ||
    pathname === "/staff/buildings/new" ||
    /^\/staff\/buildings\/[^/]+$/.test(pathname) ||
    /^\/staff\/buildings\/[^/]+\/tenants\/[^/]+$/.test(pathname) ||
    pathname.startsWith("/staff/buildings/new-v2") ||
    pathname.startsWith("/staff/utilities") ||
    pathname === "/staff/notices" ||
    pathname === "/staff/setup"
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isBuildingsIndex = pathname === "/staff/buildings";
  const isBuildingRegister =
    pathname === "/staff/buildings/new" || pathname.startsWith("/staff/buildings/new-v2");
  const isBuildingDetail = /^\/staff\/buildings\/[^/]+$/.test(pathname);
  const isTenantForm = /^\/staff\/buildings\/[^/]+\/tenants\/[^/]+$/.test(pathname);
  // 정본: 페이지는 뷰포트에 고정되고 스크롤은 목록 카드 안에서만 난다.
  const isMessaging = pathname === "/staff/messaging";
  // 셋업도 정본이 헤더·탭바 고정에 본문만 스크롤이다.
  const isSetup = pathname === "/staff/setup";
  const isViewportLocked = isBuildingsIndex || isBuildingRegister || isBuildingDetail || isTenantForm || isMessaging || isSetup;

  useEffect(() => {
    const openDrawer = () => setDrawerOpen(true);
    const toggleSidebar = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setSidebarCollapsed((value) => !value);
        return;
      }
      setDrawerOpen(true);
    };
    window.addEventListener("app-shell:open-menu", openDrawer);
    window.addEventListener("app-shell:toggle-sidebar", toggleSidebar);
    return () => {
      window.removeEventListener("app-shell:open-menu", openDrawer);
      window.removeEventListener("app-shell:toggle-sidebar", toggleSidebar);
    };
  }, []);

  if (isBare(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className={`${isViewportLocked ? "h-screen overflow-hidden" : "min-h-screen"} flex bg-bg print:block print:bg-white`}>
      {/* Desktop sidebar */}
      <div
        className={`sticky top-0 hidden h-screen shrink-0 overflow-hidden transition-[width] duration-[180ms] md:flex print:hidden ${
          sidebarCollapsed ? "w-0" : "w-[240px]"
        }`}
      >
        <Sidebar />
      </div>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 print:block">
        {!hasIntegratedHeader(pathname) && (
          <div className="print:hidden">
            <Topbar onMenu={() => window.dispatchEvent(new Event("app-shell:toggle-sidebar"))} />
          </div>
        )}
        <main className="flex-1 min-h-0 overflow-auto print:overflow-visible">
          {children}
        </main>
      </div>

      {/* 우측 A/S·퇴실 패널 (전역, print 제외) */}
      <AsReceptionRail />

      {/* 스태프 전역 빠른발송 FAB (인쇄 제외) */}
      <div className="contents print:hidden">
        <MessengerFab />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-40 bg-scrim md:hidden print:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* drawer */}
          <div className="fixed inset-y-0 left-0 z-50 md:hidden print:hidden">
            <Sidebar />
          </div>
        </>
      )}
    </div>
  );
}
