import "server-only";

import type { ResidentLink } from "@/hooks/reactquery/residentClaims/apis";
import type {
  ResidentBillDetail,
  ResidentBillDetailRow,
  ResidentBillItemRow,
  ResidentBillMonth,
  ResidentBillMonthRow,
} from "@/hooks/reactquery/residentBilling/apis";
import { createClient } from "@/lib/supabase/server";

type ResidentLinkRow = {
  claim_id: number;
  org_id: number;
  building_id: number | null;
  building_name: string | null;
  unit_id: number | null;
  unit_no: string | null;
  occupancy_id: number | null;
  tenant_name: string | null;
  occupancy_phone: string | null;
  linked_at: string;
};

const rowToResidentLink = (row: ResidentLinkRow): ResidentLink => ({
  claimId: row.claim_id,
  orgId: row.org_id,
  buildingId: row.building_id,
  buildingName: row.building_name,
  unitId: row.unit_id,
  unitNo: row.unit_no,
  occupancyId: row.occupancy_id,
  tenantName: row.tenant_name,
  occupancyPhone: row.occupancy_phone,
  linkedAt: row.linked_at,
});

const rowToBillMonth = (row: ResidentBillMonthRow): ResidentBillMonth => ({
  period: row.period,
  totalAmount: row.total_amount,
  paidAmount: row.paid_amount,
  unpaidAmount: row.unpaid_amount,
  lateFee: row.late_fee,
  paidDate: row.paid_date,
  payStatus: row.pay_status,
  dueDate: row.due_date,
  confirmedAt: row.confirmed_at,
});

const rowToBillItem = (row: ResidentBillItemRow) => ({
  feeItemId: row.fee_item_id,
  name: row.name,
  amount: row.amount,
  charged: row.charged,
  utility: row.utility ?? null,
  usage: row.usage ?? null,
  prevUsage: row.prev_usage ?? null,
});

const rowToBillDetail = (row: ResidentBillDetailRow): ResidentBillDetail => ({
  period: row.period,
  buildingName: row.building_name,
  unitNo: row.unit_no,
  tenantName: row.tenant_name,
  totalAmount: row.total_amount,
  paidAmount: row.paid_amount,
  unpaidAmount: row.unpaid_amount,
  lateFee: row.late_fee ?? 0,
  dueDate: row.due_date,
  confirmedAt: row.confirmed_at,
  items: (row.items ?? []).map(rowToBillItem),
  mgmtBank: row.mgmt_bank,
  mgmtAcct: row.mgmt_acct,
  mgmtHolder: row.mgmt_holder,
  carryoverUnpaid: row.carryover_unpaid ?? 0,
  carryoverLateFee: row.carryover_late_fee ?? 0,
});

export async function getResidentBillPageData(): Promise<{
  link: ResidentLink | null;
  months: ResidentBillMonth[];
}> {
  const supabase = await createClient();
  const [linkResult, monthsResult] = await Promise.all([
    supabase.rpc("resident_my_link"),
    supabase.rpc("resident_bill_months"),
  ]);

  if (linkResult.error) throw new Error(linkResult.error.message);
  if (monthsResult.error) throw new Error(monthsResult.error.message);

  const linkRow = ((linkResult.data ?? []) as ResidentLinkRow[])[0];
  return {
    link: linkRow ? rowToResidentLink(linkRow) : null,
    months: ((monthsResult.data ?? []) as ResidentBillMonthRow[]).map(
      rowToBillMonth,
    ),
  };
}

export async function getResidentBillDetail(
  period: string,
): Promise<ResidentBillDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resident_bill_detail", {
    p_period: period,
  });

  if (error) throw new Error(error.message);
  const row = ((data ?? []) as ResidentBillDetailRow[])[0];
  return row ? rowToBillDetail(row) : null;
}
