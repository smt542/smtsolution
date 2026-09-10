import { hasModule } from "@/lib/auth/permissions";
import { BuildingRegisterForm } from "./_components/BuildingRegisterForm";
import { getStaffContext } from "../../_staffContext";

/** 건물 등록 재설계 미리보기 라우트. 기존 /staff/buildings/new 는 그대로 유지. */
export default async function BuildingRegisterV2Page() {
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
