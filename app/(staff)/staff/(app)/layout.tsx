import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";
import { requirePasswordChanged } from "@/lib/auth/requirePasswordChanged";
import { ConfirmProvider } from "@/components/common/ConfirmProvider";
import { EntryPersonaWatcher } from "@/components/EntryPersonaWatcher";

export default async function StaffGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("manager_staff", "/staff/login");
  // 임시 비밀번호 상태면 변경을 마칠 때까지 업무 화면에 들어가지 못한다.
  await requirePasswordChanged("/staff/change-password");
  // 다른 탭에서 다른 역할로 로그인해 세션이 바뀌면 화면 이동·탭 복귀 때 로그인으로 보낸다.
  return <ConfirmProvider><EntryPersonaWatcher persona="manager_staff" />{children}</ConfirmProvider>;
}
