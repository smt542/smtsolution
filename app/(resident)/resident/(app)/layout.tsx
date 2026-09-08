import type { ReactNode } from "react";
import { requireResidentLink } from "@/lib/auth/requirePersona";

export default async function ResidentGuardedLayout({ children }: { children: ReactNode }) {
  await requireResidentLink();
  return <>{children}</>;
}
