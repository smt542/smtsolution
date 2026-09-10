import { OrgBuildingsList } from "./components/OrgBuildingsList";

export default async function PlatformOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrgBuildingsList orgId={Number(orgId)} />;
}
