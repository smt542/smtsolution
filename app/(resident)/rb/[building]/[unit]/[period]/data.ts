import "server-only";

import type {
  PublicBillBySignedResult,
  PublicBillDetail,
  PublicBillDetailRow,
} from "@/hooks/reactquery/residentBilling/apis";
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
});

export async function getPublicBillBySigned(
  buildingId: number,
  unitNo: string,
  period: string,
  sig: string,
): Promise<PublicBillBySignedResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_bill_by_signed", {
    p_building_id: buildingId,
    p_unit_no: unitNo,
    p_period: `${period.slice(0, 7)}-01`,
    p_sig: sig,
  });

  if (error) throw new Error(error.message);
  const row = ((data ?? []) as PublicBillDetailRow[])[0];
  return row ? rowToPublicBillDetail(row) : null;
}
