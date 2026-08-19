import type { Metadata } from "next";
import { PlatformAdminLayoutContent } from "./_components/PlatformAdminLayoutContent";

export const metadata: Metadata = {
  title: "플랫폼 관리 · 관리비서",
};

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return <PlatformAdminLayoutContent>{children}</PlatformAdminLayoutContent>;
}
