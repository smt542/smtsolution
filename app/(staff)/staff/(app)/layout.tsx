import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";
import { requirePasswordChanged } from "@/lib/auth/requirePasswordChanged";
import { ConfirmProvider } from "@/components/common/ConfirmProvider";

export default async function StaffGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("manager_staff", "/staff/login");
  // 임시 비밀번호 상태면 변경을 마칠 때까지 업무 화면에 들어가지 못한다.
  await requirePasswordChanged("/staff/change-password");
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
