import { AuthBoot } from "@/components/AuthBoot";
import { AccountActiveGuard } from "@/components/AccountActiveGuard";
import { AppShell } from "@/components/shell/AppShell";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (<><AuthBoot scope="staff" /><AccountActiveGuard /><AppShell>{children}</AppShell></>);
}
