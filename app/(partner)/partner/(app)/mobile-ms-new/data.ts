import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { ContextJson } from "./_ms";

export async function getPartnerSettlementContextData(
  unitId: number,
  settlementId?: number | null,
): Promise<ContextJson> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "partner_get_settlement_context",
    {
      p_unit_id: unitId,
      p_settlement_id: settlementId ?? null,
    },
  );

  if (error) throw new Error(error.message);
  return data as ContextJson;
}
