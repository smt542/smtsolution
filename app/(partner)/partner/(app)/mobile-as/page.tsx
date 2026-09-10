import { MobileAsWorkspace } from "./MobileAsWorkspace";

export default async function PartnerAsDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const value = (await searchParams).id;
  const rawId = Array.isArray(value) ? value[0] : value;
  const parsedId = rawId ? Number(rawId) : Number.NaN;
  const complaintId = Number.isFinite(parsedId) ? parsedId : null;

  return <MobileAsWorkspace complaintId={complaintId} />;
}
