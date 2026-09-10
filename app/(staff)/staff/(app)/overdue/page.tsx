import { EmptyState } from "@/components/common/EmptyState";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { OverdueWorkspace } from "./components/OverdueWorkspace";

export default async function OverduePage() {
  const me = await getStaffContext();

  if (!me || !hasModule(me, "overdue")) {
    return (
      <div className="h-[calc(100dvh-62px)] p-6">
        <EmptyState message="권한이 없습니다" />
      </div>
    );
  }

  return (
    <OverdueWorkspace
      orgId={me.orgId}
      canSendMessages={hasModule(me, "messaging")}
    />
  );
}
