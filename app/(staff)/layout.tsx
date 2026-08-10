import { AuthBoot } from "@/components/AuthBoot";
import { AppShell } from "@/components/shell/AppShell";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (<><AuthBoot /><AppShell>{children}</AppShell></>);
}
