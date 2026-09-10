import { UnitDetailView } from "./components/UnitDetailView";

export default async function PlatformUnitDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; buildingId: string; unitId: string }>;
}) {
  const { orgId, buildingId, unitId } = await params;
  return <UnitDetailView orgId={Number(orgId)} buildingId={Number(buildingId)} unitId={Number(unitId)} />;
}
