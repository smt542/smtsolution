import { EmptyState } from "@/components/common";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { ManagementFeeWorkspace } from "./ManagementFeeWorkspace";

export default async function ManagementFeePage() {
  const me = await getStaffContext();

  if (!me || !hasModule(me, "billing")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (부과 확정 권한 필요)" />
      </div>
    );
  }

  return <ManagementFeeWorkspace />;
}
