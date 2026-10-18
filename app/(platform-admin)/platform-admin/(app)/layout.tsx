import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";
import { requirePasswordChanged } from "@/lib/auth/requirePasswordChanged";
import { AccountActiveGuard } from "@/components/AccountActiveGuard";
import { EntryPersonaWatcher } from "@/components/EntryPersonaWatcher";
import { ConfirmProvider } from "@/components/common/ConfirmProvider";
import { PlatformAdminGuard } from "../../_components/PlatformAdminGuard";
import { PlatformShell } from "../../_components/PlatformShell";

// 서버 게이트를 클라이언트 가드보다 먼저 둔다. 가드는 확인 중·권한 없음일 때 children을 그리지 않아서,
// 위에 있으면 게이트의 redirect(역할 불일치 → switch-entry)가 실행되지 못하고 안내 화면에 묻힌다.
export default async function PlatformAdminGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("platform_admin", "/platform-admin/login");
  // 임시 비밀번호 상태면 변경을 마칠 때까지 관리 화면에 들어가지 못한다.
  await requirePasswordChanged("/platform-admin/change-password");
  return (
    <>
      <AccountActiveGuard />
      <EntryPersonaWatcher persona="platform_admin" />
      <PlatformAdminGuard>
        <PlatformShell>
          <ConfirmProvider>{children}</ConfirmProvider>
        </PlatformShell>
      </PlatformAdminGuard>
    </>
  );
}
