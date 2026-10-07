import "server-only";

import type {
  PublicBillBySignedResult,
  PublicBillDetail,
  PublicBillDetailRow,
} from "@/hooks/reactquery/residentBilling/apis";
import { extractHeadersMeta, logAccess } from "@/lib/audit/accessLog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const rowToPublicBillDetail = (
  row: PublicBillDetailRow,
): PublicBillDetail => ({
  period: row.period,
  buildingName: row.building_name,
  unitNo: row.unit_no,
  totalAmount: row.total_amount,
  paidAmount: row.paid_amount,
  unpaidAmount: row.unpaid_amount,
  lateFee: row.late_fee,
  dueDate: row.due_date,
  items: (row.items ?? []).map((item) => ({
    name: item.name,
    amount: item.amount,
    utility: item.utility ?? null,
    usage: item.usage ?? null,
    prevUsage: item.prev_usage ?? null,
  })),
  mgmtBank: row.mgmt_bank,
  mgmtAcct: row.mgmt_acct,
  mgmtHolder: row.mgmt_holder,
  expiresAt: row.expires_at,
  isExpired: row.is_expired,
  carryoverUnpaid: row.carryover_unpaid,
  carryoverLateFee: row.carryover_late_fee,
});

export async function getPublicBillBySigned(
  buildingId: number,
  unitNo: string,
  period: string,
  sig: string,
  issuedDay?: number,
): Promise<PublicBillBySignedResult> {
  const supabase = await createClient();
  const rpcParams = {
    p_building_id: buildingId,
    p_unit_no: unitNo,
    p_period: `${period.slice(0, 7)}-01`,
    p_sig: sig,
    ...(issuedDay === undefined ? {} : { p_issued_day: issuedDay }),
  };
  const { data, error } = await supabase.rpc("public_bill_by_signed", rpcParams);

  if (error) throw new Error(error.message);
  const row = ((data ?? []) as PublicBillDetailRow[])[0];
  const detail = row ? rowToPublicBillDetail(row) : null;
  if (detail && !detail.isExpired) {
    let orgId: number | null = null;
    try {
      const { data: building, error: orgError } = await createAdminClient()
        .from("buildings")
        .select("org_id")
        .eq("id", buildingId)
        .maybeSingle();
      if (!orgError) orgId = building?.org_id ?? null;
    } catch {
      // Keep rendering the public bill when the audit scope lookup fails.
    }
    const requestMeta = await extractHeadersMeta();
    await logAccess({
      ...requestMeta,
      orgId,
      event: "PUBLIC_LINK_VIEW",
      persona: "public",
      targetKind: "bill_issue",
      targetId: `${buildingId}:${unitNo}:${period.slice(0, 7)}`,
    });
  }

  return detail;
}
