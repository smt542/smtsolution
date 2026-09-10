import { EmptyState } from "@/components/common";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { FeeItemManagement } from "./components/FeeItemManagement";

export default async function FeeItemsPage() {
  const me = await getStaffContext();

  if (!me || !hasModule(me, "fee_items")) {
    return <div className="p-6"><EmptyState message="권한이 없습니다" /></div>;
  }

  return <FeeItemManagement orgId={me.orgId} />;
}
