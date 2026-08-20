import { createClient } from "@/lib/supabase/server";

import { InquiryView, type BuildingRow, type TenantRow } from "./InquiryView";

export const dynamic = "force-dynamic";

export default async function PartnerInquiryPage() {
  const supabase = await createClient();
  const [{ data: b }, { data: t }] = await Promise.all([
    supabase.rpc("partner_list_buildings"),
    supabase.rpc("partner_search_tenants"),
  ]);
  const buildings = (Array.isArray(b) ? b : []) as BuildingRow[];
  const tenants = (Array.isArray(t) ? t : []) as TenantRow[];
  return <InquiryView buildings={buildings} tenants={tenants} />;
}
