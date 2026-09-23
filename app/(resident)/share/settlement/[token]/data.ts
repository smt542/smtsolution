import "server-only";

import type {
  PublicSettlement,
  PublicSettlementByTokenResult,
  PublicSettlementRow,
} from "@/hooks/reactquery/residentSettlement/apis";
import { extractHeadersMeta, logAccess } from "@/lib/audit/accessLog";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const settlement = data ? rowToPublicSettlement(data as PublicSettlementRow) : null;
  if (settlement && !settlement.isExpired) {
    let orgId: number | null = null;
    try {
      const { data: tokenRow, error: orgError } = await createAdminClient()
        .from("settlement_share_tokens")
        .select("org_id")
        .eq("token", token)
        .maybeSingle();
      if (!orgError) orgId = tokenRow?.org_id ?? null;
    } catch {
      // Keep rendering the public settlement when the audit scope lookup fails.
    }
    const requestMeta = await extractHeadersMeta();
    await logAccess({
      ...requestMeta,
      orgId,
      event: "PUBLIC_LINK_VIEW",
      persona: "public",
      targetKind: "settlement",
      targetId: token,
    });
  }

  return settlement;
}
