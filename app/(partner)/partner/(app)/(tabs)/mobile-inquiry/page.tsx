import { createClient } from "@/lib/supabase/server";

import { InquiryView, type BuildingRow, type TenantRow } from "./InquiryView";

export const dynamic = "force-dynamic";

export default async function PartnerInquiryPage() {
  const supabase = await createClient();
  const [{ data: b, error: buildingsError }, { data: t, error: tenantsError }] = await Promise.all([
    supabase.rpc("partner_list_buildings"),
    supabase.rpc("partner_search_tenants"),
  ]);
  // 조회 실패를 빈 목록으로 보여주지 않는다.
  if (buildingsError) throw new Error(buildingsError.message);
  if (tenantsError) throw new Error(tenantsError.message);
  const buildings = (Array.isArray(b) ? b : []) as BuildingRow[];
  const tenants = (Array.isArray(t) ? t : []) as TenantRow[];
  return <InquiryView buildings={buildings} tenants={tenants} />;
}
