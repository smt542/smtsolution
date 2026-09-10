import { getMobileTenantData } from "./data";
import { MobileTenantWorkspace } from "./MobileTenantWorkspace";

export default async function PartnerTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const value = (await searchParams).id;
  const rawId = Array.isArray(value) ? value[0] : value;
  const parsedId = rawId ? Number(rawId) : Number.NaN;
  const unitId = Number.isFinite(parsedId) ? parsedId : null;
  const data = await getMobileTenantData(unitId);

  return <MobileTenantWorkspace data={data} />;
}
