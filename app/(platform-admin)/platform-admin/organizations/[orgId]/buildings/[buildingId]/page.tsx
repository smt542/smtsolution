"use client";
import { useParams } from "next/navigation";
import { BuildingTenantsList } from "./components/BuildingTenantsList";

export default function PlatformBuildingDetailPage() {
  const { orgId, buildingId } = useParams<{ orgId: string; buildingId: string }>();
  return <BuildingTenantsList orgId={Number(orgId)} buildingId={Number(buildingId)} />;
}
