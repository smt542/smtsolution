import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";
import { ConfirmProvider } from "@/components/common/ConfirmProvider";

export default async function StaffGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("manager_staff", "/staff/login");
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
