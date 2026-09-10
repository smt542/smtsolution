import { hasModule } from "@/lib/auth/permissions";
import { BuildingRegisterForm } from "../new-v2/_components/BuildingRegisterForm";
import { getStaffContext } from "../../_staffContext";

type BuildingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BuildingDetailPage({ params }: BuildingDetailPageProps) {
  const [{ id }, me] = await Promise.all([params, getStaffContext()]);

  if (!hasModule(me, "buildings")) {
    return <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (건물 관리 권한 필요)</p>;
  }

  return <BuildingRegisterForm buildingId={Number(id)} />;
}
