import "server-only";

import { createClient } from "@/lib/supabase/server";

export type LongTermRepairBuilding = {
  id: number;
  code: string;
  name: string;
};

export async function getLongTermRepairPageData(orgId: number) {
  const supabase = await createClient();
  const [buildingsResult, organizationResult] = await Promise.all([
    supabase
      .from("buildings")
      .select("id, code, name")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle(),
  ]);

  if (buildingsResult.error) throw new Error(buildingsResult.error.message);
  if (organizationResult.error) throw new Error(organizationResult.error.message);

  return {
    buildings: (buildingsResult.data ?? []) as LongTermRepairBuilding[],
    organizationName: organizationResult.data?.name ?? null,
  };
}
