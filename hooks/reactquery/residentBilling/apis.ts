import { createClient } from "@/lib/supabase/client";

export type ResidentBillPayStatus = "paid" | "partial" | "unpaid" | "none";

export interface ResidentBillMonthRow {
  period: string;
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  late_fee: number;
  paid_date: string | null;
  pay_status: ResidentBillPayStatus;
  due_date: string | null;
  confirmed_at: string;
}

export interface ResidentBillMonth {
  period: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  /** 세대 자기 스코프 연체료(원). 미납·납기 있는 월만 산정, 그 외 0. staff /overdue와 동일 알고리즘. */
  lateFee: number;
  /** 완납월 납부일(ISO date). 해당 월 active 납부 max(paid_at). 납부 없으면 null. */
  paidDate: string | null;
  payStatus: ResidentBillPayStatus;
  dueDate: string | null;
  confirmedAt: string;
}

export type ResidentBillMonthsResult = ResidentBillMonth[];

/** 개별 사용료 분류(fee_items.name 매칭). 공용·기타 항목은 null. */
export type ResidentBillUtility = "water" | "elec" | "gas";

export interface ResidentBillItemRow {
  fee_item_id: number;
  name: string;
  amount: number;
  charged: boolean;
  utility: ResidentBillUtility | null;
  usage: number | null;
  prev_usage: number | null;
}

export interface ResidentBillItem {
  feeItemId: number;
  name: string;
  amount: number;
  charged: boolean;
  /** 개별 사용료면 'water'|'elec'|'gas', 공용·기타면 null. */
  utility: ResidentBillUtility | null;
  /** 당월 검침 사용량(water=톤·elec=kWh·gas=㎥). 검침 없으면 null. */
  usage: number | null;
  /** 전월 검침 사용량. 없으면 null. */
  prevUsage: number | null;
}

export interface ResidentBillDetailRow {
  period: string;
  building_name: string;
  unit_no: string;
  tenant_name: string | null;
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  late_fee: number;
  due_date: string | null;
  confirmed_at: string;
  items: ResidentBillItemRow[] | null;
  mgmt_bank: string | null;
  mgmt_acct: string | null;
  mgmt_holder: string | null;
  carryover_unpaid: number | null;
  carryover_late_fee: number | null;
}

export interface ResidentBillDetail {
  period: string;
  buildingName: string;
  unitNo: string;
  tenantName: string | null;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  /** 세대 자기 스코프 연체료(원). 미납·납기 있는 월만 산정, 그 외 0. */
  lateFee: number;
  dueDate: string | null;
  confirmedAt: string;
  items: ResidentBillItem[];
  mgmtBank: string | null;
  mgmtAcct: string | null;
  mgmtHolder: string | null;
  /** 전월까지 이월된 미납 원금(원). 같은 입주의 이전 월 확정 부과 기준. */
  carryoverUnpaid: number;
  /** 이월 미납에 대한 연체료(원). 기준월 = 고지서 월. */
  carryoverLateFee: number;
}

export type ResidentBillDetailResult = ResidentBillDetail | null;

/** resident_sign_bill_url / staff_sign_bill_urls 원본 행(서명 계산 결과). */
export interface SignedBillLinkRow {
  building_id: number;
  unit_no: string;
  sig: string;
  issued_day?: number | null;
}

export interface SignedBillLink {
  buildingId: number;
  unitNo: string;
  sig: string;
  issuedDay?: number | null;
}

export interface StaffSignBillUrlRow {
  unit_id: number;
  building_id: number;
  unit_no: string;
  sig: string;
  issued_day?: number | null;
}

export interface StaffSignedBillLink {
  unitId: number;
  buildingId: number;
  unitNo: string;
  sig: string;
  issuedDay?: number | null;
}

export interface StaffSignBillUrlsPayload {
  unitIds: number[];
  period: string;
}

export interface PublicBillItemRow {
  name: string;
  amount: number;
  utility: ResidentBillUtility | null;
  usage: number | null;
  prev_usage: number | null;
}

export interface PublicBillItem {
  name: string;
  amount: number;
  utility: ResidentBillUtility | null;
  usage: number | null;
  prevUsage: number | null;
}

export interface PublicBillDetailRow {
  period: string;
  building_name: string;
  unit_no: string;
  total_amount: number | null;
  paid_amount: number | null;
  unpaid_amount: number | null;
  late_fee: number | null;
  due_date: string | null;
  items: PublicBillItemRow[] | null;
  mgmt_bank: string | null;
  mgmt_acct: string | null;
  mgmt_holder: string | null;
  expires_at: string;
  is_expired: boolean;
  carryover_unpaid: number | null;
  carryover_late_fee: number | null;
}

export interface PublicBillDetail {
  period: string;
  buildingName: string;
  unitNo: string;
  totalAmount: number | null;
  paidAmount: number | null;
  unpaidAmount: number | null;
  /** 연체료(원). 만료 링크면 null 마스킹. */
  lateFee: number | null;
  dueDate: string | null;
  items: PublicBillItem[];
  mgmtBank: string | null;
  mgmtAcct: string | null;
  mgmtHolder: string | null;
  expiresAt: string;
  isExpired: boolean;
  /** 전월까지 이월된 미납 원금(원). 만료 링크면 null 마스킹. */
  carryoverUnpaid: number | null;
  /** 이월 미납에 대한 연체료(원). 만료 링크면 null 마스킹. */
  carryoverLateFee: number | null;
}

export type PublicBillBySignedResult = PublicBillDetail | null;

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

const rowToBillItem = (row: ResidentBillItemRow): ResidentBillItem => ({
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

// 서명 경로 생성은 서버(팩스 PDF)와 공유하도록 lib/bill/document.ts에 둔다.
export { signedBillPath } from "@/lib/bill/document";

/** 세입자 본인 세대의 무로그인 서명 링크(building_id·unit_no·sig)를 자동 발급한다. */
export async function residentSignBillUrl(
  period: string,
): Promise<SignedBillLink | null> {
  const { data, error } = await createClient().rpc("resident_sign_bill_url", {
    p_period: period,
  });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as SignedBillLinkRow[])[0];
  return row
    ? {
        buildingId: row.building_id,
        unitNo: row.unit_no,
        sig: row.sig,
        issuedDay: row.issued_day,
      }
    : null;
}

/** staff가 세대별 무로그인 서명 링크를 대량 자동 발급(org + bill_publish 스코프). */
export async function staffSignBillUrls(
  payload: StaffSignBillUrlsPayload,
): Promise<StaffSignedBillLink[]> {
  const { data, error } = await createClient().rpc("staff_sign_bill_urls", {
    p_unit_ids: payload.unitIds,
    p_period: payload.period,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as StaffSignBillUrlRow[]).map((row) => ({
    unitId: row.unit_id,
    buildingId: row.building_id,
    unitNo: row.unit_no,
    sig: row.sig,
    issuedDay: row.issued_day,
  }));
}
