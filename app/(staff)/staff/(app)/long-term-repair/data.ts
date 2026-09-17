import "server-only";

import { createClient } from "@/lib/supabase/server";

export type LongTermRepairBuilding = {
  id: number;
  code: string;
  name: string;
};

export async function getLongTermRepairPageData(orgId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buildings")
    .select("id, code, name")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("name");

  if (error) throw new Error(error.message);

  return { buildings: (data ?? []) as LongTermRepairBuilding[] };
}
