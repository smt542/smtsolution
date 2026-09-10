import { getPartnerBuildingPageData } from "./data";
import PartnerBuildingWorkspace from "./PartnerBuildingWorkspace";

type PartnerBuildingPageProps = {
  searchParams: Promise<{ id?: string | string[] }>;
};

export default async function PartnerBuildingPage({
  searchParams,
}: PartnerBuildingPageProps) {
  const { id } = await searchParams;
  const idSegment = Array.isArray(id) ? id[0] : id;
  const parsedId = idSegment ? Number(idSegment) : Number.NaN;
  const buildingId = Number.isFinite(parsedId) ? parsedId : null;
  const pageData = buildingId != null
    ? await getPartnerBuildingPageData(buildingId)
    : { building: null, units: [], vendors: [] };

  return (
    <PartnerBuildingWorkspace
      buildingId={buildingId}
      building={pageData.building}
      units={pageData.units}
      vendors={pageData.vendors}
    />
  );
}
