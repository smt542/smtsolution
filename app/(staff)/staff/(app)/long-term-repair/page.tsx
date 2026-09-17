import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { LongTermRepairLedger } from "./components/LongTermRepairLedger";
import { getLongTermRepairPageData } from "./data";

export default async function LongTermRepairPage() {
  const me = await getStaffContext();

  if (!me || !hasModule(me, "settings")) {
    return <div className="p-8 text-sm text-t2">이 화면에 접근할 권한이 없습니다. (장기수선비 관리 권한 필요)</div>;
  }

  const { buildings } = await getLongTermRepairPageData(me.orgId);

  return (
    <LongTermRepairLedger
      orgId={me.orgId}
      buildings={buildings}
    />
  );
}
