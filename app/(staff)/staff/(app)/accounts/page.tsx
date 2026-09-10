import { EmptyState } from "@/components/common/EmptyState";
import { canManageAccounts, isMaster } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { AccountsWorkspace } from "./components/AccountsWorkspace";

export default async function AccountsPage() {
  const me = await getStaffContext();

  if (!canManageAccounts(me)) {
    return (
      <div className="p-6">
        <EmptyState message="권한이 없습니다" />
      </div>
    );
  }

  return <AccountsWorkspace canEditPermissions={isMaster(me?.role)} />;
}
