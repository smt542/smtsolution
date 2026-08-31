"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  children: React.ReactNode;
}

/** Paths that render bare (no shell). */
function isBare(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/staff/login");
}

/** Figma 자체 62px 헤더를 렌더하는 화면. */
function hasIntegratedHeader(pathname: string): boolean {
  return (
    pathname.startsWith("/staff/buildings/new-v2") ||
    pathname.startsWith("/staff/utilities")
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const openDrawer = () => setDrawerOpen(true);
    window.addEventListener("app-shell:open-menu", openDrawer);
    return () => window.removeEventListener("app-shell:open-menu", openDrawer);
  }, []);

  if (isBare(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-bg print:block print:bg-white">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-screen sticky top-0 print:hidden">
        <Sidebar />
      </div>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 print:block">
        {!hasIntegratedHeader(pathname) && (
          <div className="print:hidden">
            <Topbar onMenu={() => setDrawerOpen(true)} />
          </div>
        )}
        <main className="flex-1 overflow-auto print:overflow-visible">
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden print:hidden"
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
