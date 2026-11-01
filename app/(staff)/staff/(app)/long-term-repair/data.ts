import "server-only";

import { createClient } from "@/lib/supabase/server";

export type LongTermRepairBuilding = {
  id: number;
  code: string;
  name: string;
};

export async function getLongTermRepairPageData(orgId: number) {
  const supabase = await createClient();
  // 대상: 적립금 유형이 "장기수선충당금"인 건물 + 유형과 무관하게 장기수선 원장 기록이 있는 건물(기록이 숨지 않도록).
  const [typed, ledger] = await Promise.all([
    supabase
      .from("buildings")
      .select("id, code, name")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .eq("reserve_fund->>type", "장기수선충당금"),
    supabase.from("long_term_repair_ledger").select("building_id").eq("org_id", orgId),
  ]);

  if (typed.error) throw new Error(typed.error.message);
  if (ledger.error) throw new Error(ledger.error.message);

  const typedRows = (typed.data ?? []) as LongTermRepairBuilding[];
  const typedIds = new Set(typedRows.map((b) => b.id));
  const extraIds = [...new Set((ledger.data ?? []).map((r) => r.building_id as number))].filter(
    (id) => !typedIds.has(id),
  );

  let extraRows: LongTermRepairBuilding[] = [];
  if (extraIds.length > 0) {
    const extra = await supabase
      .from("buildings")
      .select("id, code, name")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .in("id", extraIds);
    if (extra.error) throw new Error(extra.error.message);
    extraRows = (extra.data ?? []) as LongTermRepairBuilding[];
  }

  const buildings = [...typedRows, ...extraRows].sort(
    (a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name),
  );
  return { buildings };
}
