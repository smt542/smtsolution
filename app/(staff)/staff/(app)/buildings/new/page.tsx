import { hasModule } from "@/lib/auth/permissions";
import { BuildingRegisterForm } from "../new-v2/_components/BuildingRegisterForm";
import { getStaffContext } from "../../_staffContext";

export default async function BuildingNewPage() {
  const me = await getStaffContext();

  if (!hasModule(me, "buildings")) {
    return (
      <div className="p-6">
        <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (건물 관리 권한 필요)</p>
      </div>
    );
  }

  return <BuildingRegisterForm />;
}
