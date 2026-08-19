import { createClient } from "@/lib/supabase/client";

export type ResidentBillPayStatus = "paid" | "partial" | "unpaid" | "none";

export interface ResidentBillMonthRow {
  period: string;
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  pay_status: ResidentBillPayStatus;
  due_date: string | null;
  confirmed_at: string;
}

export interface ResidentBillMonth {
  period: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  payStatus: ResidentBillPayStatus;
  dueDate: string | null;
  confirmedAt: string;
}

export type ResidentBillMonthsResult = ResidentBillMonth[];

export interface ResidentBillItemRow {
  fee_item_id: number;
  name: string;
  amount: number;
  charged: boolean;
}

export interface ResidentBillItem {
  feeItemId: number;
  name: string;
  amount: number;
  charged: boolean;
}

export interface ResidentBillDetailRow {
  period: string;
  building_name: string;
  unit_no: string;
  tenant_name: string | null;
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  due_date: string | null;
  confirmed_at: string;
  items: ResidentBillItemRow[] | null;
  mgmt_bank: string | null;
  mgmt_acct: string | null;
  mgmt_holder: string | null;
}

export interface ResidentBillDetail {
  period: string;
  buildingName: string;
  unitNo: string;
  tenantName: string | null;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  dueDate: string | null;
  confirmedAt: string;
  items: ResidentBillItem[];
  mgmtBank: string | null;
  mgmtAcct: string | null;
  mgmtHolder: string | null;
}

export type ResidentBillDetailResult = ResidentBillDetail | null;
export type ResidentBillTokenResult = string;

export interface PublicBillItemRow {
  name: string;
  amount: number;
}

export interface PublicBillItem {
  name: string;
  amount: number;
}

export interface PublicBillDetailRow {
  period: string;
  building_name: string;
  unit_no: string;
  total_amount: number | null;
  paid_amount: number | null;
  unpaid_amount: number | null;
  due_date: string | null;
  items: PublicBillItemRow[] | null;
  mgmt_bank: string | null;
  mgmt_acct: string | null;
  mgmt_holder: string | null;
  expires_at: string;
  is_expired: boolean;
}

export interface PublicBillDetail {
  period: string;
  buildingName: string;
  unitNo: string;
  totalAmount: number | null;
  paidAmount: number | null;
  unpaidAmount: number | null;
  dueDate: string | null;
  items: PublicBillItem[];
  mgmtBank: string | null;
  mgmtAcct: string | null;
  mgmtHolder: string | null;
  expiresAt: string;
  isExpired: boolean;
}

export type PublicBillByTokenResult = PublicBillDetail | null;

const rowToBillMonth = (row: ResidentBillMonthRow): ResidentBillMonth => ({
  period: row.period,
  totalAmount: row.total_amount,
  paidAmount: row.paid_amount,
  unpaidAmount: row.unpaid_amount,
  payStatus: row.pay_status,
  dueDate: row.due_date,
  confirmedAt: row.confirmed_at,
});

const rowToBillItem = (row: ResidentBillItemRow): ResidentBillItem => ({
  feeItemId: row.fee_item_id,
  name: row.name,
  amount: row.amount,
  charged: row.charged,
});

const rowToBillDetail = (row: ResidentBillDetailRow): ResidentBillDetail => ({
  period: row.period,
  buildingName: row.building_name,
  unitNo: row.unit_no,
  tenantName: row.tenant_name,
  totalAmount: row.total_amount,
  paidAmount: row.paid_amount,
  unpaidAmount: row.unpaid_amount,
  dueDate: row.due_date,
  confirmedAt: row.confirmed_at,
  items: (row.items ?? []).map(rowToBillItem),
  mgmtBank: row.mgmt_bank,
  mgmtAcct: row.mgmt_acct,
  mgmtHolder: row.mgmt_holder,
});

const rowToPublicBillDetail = (
  row: PublicBillDetailRow,
): PublicBillDetail => ({
  period: row.period,
  buildingName: row.building_name,
  unitNo: row.unit_no,
  totalAmount: row.total_amount,
  paidAmount: row.paid_amount,
  unpaidAmount: row.unpaid_amount,
  dueDate: row.due_date,
  items: (row.items ?? []).map((item) => ({
    name: item.name,
    amount: item.amount,
  })),
  mgmtBank: row.mgmt_bank,
  mgmtAcct: row.mgmt_acct,
  mgmtHolder: row.mgmt_holder,
  expiresAt: row.expires_at,
  isExpired: row.is_expired,
});

export async function residentBillMonths(): Promise<ResidentBillMonthsResult> {
  const { data, error } = await createClient().rpc("resident_bill_months");
  if (error) throw new Error(error.message);
  return ((data ?? []) as ResidentBillMonthRow[]).map(rowToBillMonth);
}

export async function residentBillDetail(
  period: string,
): Promise<ResidentBillDetailResult> {
  const { data, error } = await createClient().rpc("resident_bill_detail", {
    p_period: period,
  });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as ResidentBillDetailRow[])[0];
  return row ? rowToBillDetail(row) : null;
}

export async function residentGetOrCreateBillToken(
  period: string,
): Promise<ResidentBillTokenResult> {
  const { data, error } = await createClient().rpc(
    "resident_get_or_create_bill_token",
    { p_period: period },
  );
  if (error) throw new Error(error.message);
  if (typeof data !== "string") {
    throw new Error("관리비 공유 링크를 만들지 못했습니다.");
  }
  return data;
}

export async function publicBillByToken(
  token: string,
): Promise<PublicBillByTokenResult> {
  const { data, error } = await createClient().rpc("public_bill_by_token", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as PublicBillDetailRow[])[0];
  return row ? rowToPublicBillDetail(row) : null;
}
