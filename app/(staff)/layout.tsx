import { AuthBoot } from "@/components/AuthBoot";
import { AccountActiveGuard } from "@/components/AccountActiveGuard";
import { AppShell } from "@/components/shell/AppShell";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (<><AuthBoot /><AccountActiveGuard /><AppShell>{children}</AppShell></>);
}
