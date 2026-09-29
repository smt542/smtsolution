import type { Metadata } from "next";
import { AuthBoot } from "@/components/AuthBoot";

export const metadata: Metadata = {
  title: "플랫폼 관리 · 관리비서",
};

// 로그인 화면을 포함한 공통 레이아웃. 게이트·셸은 platform-admin/(app)/layout.tsx에 있다.
export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthBoot />
      {children}
    </>
  );
}
