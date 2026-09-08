import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";

export default async function PlatformAdminGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("platform_admin", "/platform-admin/login");
  return <>{children}</>;
}
