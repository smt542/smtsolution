"use client";
import { useParams } from "next/navigation";
import { UnitDetailView } from "./components/UnitDetailView";

export default function PlatformUnitDetailPage() {
  const { orgId, buildingId, unitId } = useParams<{ orgId: string; buildingId: string; unitId: string }>();
  return <UnitDetailView orgId={Number(orgId)} buildingId={Number(buildingId)} unitId={Number(unitId)} />;
}
