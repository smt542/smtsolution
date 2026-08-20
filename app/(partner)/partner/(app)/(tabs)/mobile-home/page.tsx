import { createClient } from "@/lib/supabase/server";

import { AsList, type AsRow } from "./AsList";

export const dynamic = "force-dynamic";

export default async function PartnerHomePage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("partner_list_complaints");
  const rows = (Array.isArray(data) ? data : []) as AsRow[];
  return <AsList rows={rows} />;
}
