import { EmptyState } from "@/components/common/EmptyState";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { MovingSettlementWorkspace } from "./components/MovingSettlementWorkspace";

export default async function MovingSettlementPage() {
  const me = await getStaffContext();

  if (!hasModule(me, "moving")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (이사정산 권한 필요)" />
      </div>
    );
  }

  return <MovingSettlementWorkspace />;
}
