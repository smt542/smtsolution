import { BuildingTenantsList } from "./components/BuildingTenantsList";

export default async function PlatformBuildingDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; buildingId: string }>;
}) {
  const { orgId, buildingId } = await params;
  return <BuildingTenantsList orgId={Number(orgId)} buildingId={Number(buildingId)} />;
}
