import "server-only";

import type {
  PublicSettlement,
  PublicSettlementByTokenResult,
  PublicSettlementRow,
} from "@/hooks/reactquery/residentSettlement/apis";
import { createClient } from "@/lib/supabase/server";

const rowToPublicSettlement = (
  row: PublicSettlementRow,
): PublicSettlement => ({
  moveOutDate: row.move_out_date,
  settlementKind: row.settlement_kind,
  settlementAmount: row.settlement_amount,
  unitLabel: row.unit_label,
  buildingName: row.building_name,
  isExpired: row.is_expired,
});

export async function getPublicSettlementByToken(
  token: string,
): Promise<PublicSettlementByTokenResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_settlement_by_token", {
    p_token: token,
  });

  if (error) throw new Error(error.message);
  return data ? rowToPublicSettlement(data as PublicSettlementRow) : null;
}
