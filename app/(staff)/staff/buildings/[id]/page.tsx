"use client";
import { useParams } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { BuildingForm } from "../components/BuildingForm";

export default function BuildingDetailPage() {
  const { data: me } = useMe();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  if (me === undefined) return null;
  if (!hasModule(me, "buildings")) {
    return <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (건물 관리 권한 필요)</p>;
  }
  return <BuildingForm buildingId={id} />;
}
