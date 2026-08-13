import type { Metadata } from "next";
import { AuthBoot } from "@/components/AuthBoot";
import { AccountActiveGuard } from "@/components/AccountActiveGuard";
import { PlatformAdminGuard } from "./_components/PlatformAdminGuard";
import { PlatformShell } from "./_components/PlatformShell";

export const metadata: Metadata = {
  title: "플랫폼 관리 · 관리비서",
};

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
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
