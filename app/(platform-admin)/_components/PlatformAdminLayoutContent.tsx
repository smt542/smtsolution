"use client";

import { usePathname } from "next/navigation";
import { AccountActiveGuard } from "@/components/AccountActiveGuard";
import { AuthBoot } from "@/components/AuthBoot";
import { PlatformAdminGuard } from "./PlatformAdminGuard";
import { PlatformShell } from "./PlatformShell";

export function PlatformAdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/platform-admin/login") {
    return <><AuthBoot />{children}</>;
  }

  return (
    <>
      <AuthBoot />
      <AccountActiveGuard />
      <PlatformAdminGuard>
        <PlatformShell>{children}</PlatformShell>
      </PlatformAdminGuard>
    </>
  );
}
