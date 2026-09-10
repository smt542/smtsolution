import PartnerMeterWorkspace from "./PartnerMeterWorkspace";

type PartnerMeterPageProps = {
  searchParams: Promise<{ id?: string | string[] }>;
};

export default async function PartnerMeterPage({ searchParams }: PartnerMeterPageProps) {
  const { id } = await searchParams;
  const idSegment = Array.isArray(id) ? id[0] : id;
  const parsedBuildingId = idSegment ? Number(idSegment) : Number.NaN;

  return <PartnerMeterWorkspace buildingId={Number.isFinite(parsedBuildingId) ? parsedBuildingId : null} />;
}
