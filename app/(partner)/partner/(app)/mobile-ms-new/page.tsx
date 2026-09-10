import type { ContextJson } from "./_ms";
import { getPartnerSettlementContextData } from "./data";
import PartnerMsNewWorkspace from "./PartnerMsNewWorkspace";

type PartnerMsNewPageProps = {
  searchParams: Promise<{
    unitId?: string | string[];
    settlementId?: string | string[];
  }>;
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function PartnerMsNewPage({
  searchParams,
}: PartnerMsNewPageProps) {
  const query = await searchParams;
  const unitId = Number(first(query.unitId) ?? null);
  const settlementIdParam = first(query.settlementId);
  const editId = settlementIdParam ? Number(settlementIdParam) : null;

  let contextData: ContextJson | null = null;
  let loadError = !Number.isFinite(unitId) || unitId <= 0;
  if (!loadError) {
    try {
      contextData = await getPartnerSettlementContextData(unitId, editId);
    } catch {
      loadError = true;
    }
  }

  return (
    <PartnerMsNewWorkspace
      unitId={unitId}
      editId={editId}
      contextData={contextData}
      loadError={loadError}
    />
  );
}
