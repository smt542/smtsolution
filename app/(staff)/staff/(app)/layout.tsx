import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";

export default async function StaffGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("manager_staff", "/staff/login");
  return <>{children}</>;
}
