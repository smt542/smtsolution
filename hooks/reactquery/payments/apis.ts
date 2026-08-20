import { createClient } from "@/lib/supabase/client";
import { computeUnpaid, derivePayStatus, type PayStatus } from "@/lib/payments/status";

export type PaymentMethod = "cash" | "transfer" | "auto_debit" | "giro" | "card" | "other";
export type PaymentKind = "full" | "principal" | "partial";
export type { PayStatus };

export interface PaymentRow {
  unitId: number; unitNo: string; dong: string | null;
  occupancyId: number | null; tenantName: string | null; isVacant: boolean;
  isAutoDebit: boolean; dueDate: string | null;
  payerNo: string | null; payerName: string | null;
  charged: number | null; paid: number; unpaid: number | null; payStatus: PayStatus;
}
export interface PaymentBalance { charged: number | null; paid: number; unpaid: number | null; }
export interface RecordPaymentInput {
  unitId: number; period: string; amount: number; fee?: number;
  method: PaymentMethod; kind: PaymentKind; memo?: string | null; paidAt?: string | null;
}
export interface UnitPayment {
  id: number; amount: number; fee: number; method: PaymentMethod; kind: PaymentKind;
  memo: string | null; paidAt: string; status: "active" | "canceled"; createdAt: string;
}
export interface GiroPayment {
  id: number; unitNo: string; dong: string | null; tenantName: string | null;
  amount: number; paidAt: string; status: "active" | "canceled"; memo: string | null;
}
export interface BankPaymentEntry { unitId: number; amount: number; paidAt: string | null; memo?: string | null; }
export interface BankPaymentRef { unitId: number; amount: number; paidAt: string; }

type PaymentRowDb = {
  unit_id: number; unit_no: string; dong: string | null; occupancy_id: number | null;
  tenant_name: string | null; is_vacant: boolean; is_auto_debit: boolean;
  due_date: string | null; charged: number | null; paid: number;
  payer_no: string | null; payer_name: string | null;
};
type BalanceDb = { charged: number | null; paid: number; unpaid: number | null };
type UnitPaymentDb = {
  id: number; amount: number; fee: number; method: PaymentMethod; kind: PaymentKind;
  memo: string | null; paid_at: string; status: "active" | "canceled"; created_at: string;
};
type GiroPaymentDb = {
  id: number; unit_no: string; dong: string | null; tenant_name: string | null;
  amount: number; paid_at: string; status: "active" | "canceled"; memo: string | null;
};

export async function listPaymentRows(buildingId: number, period: string): Promise<PaymentRow[]> {
  const { data, error } = await createClient().rpc("list_payment_rows", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PaymentRowDb[]).map((r) => ({
    unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong,
    occupancyId: r.occupancy_id, tenantName: r.tenant_name, isVacant: r.is_vacant,
    isAutoDebit: r.is_auto_debit, dueDate: r.due_date,
    payerNo: r.payer_no, payerName: r.payer_name,
    charged: r.charged, paid: r.paid,
    unpaid: computeUnpaid(r.charged, r.paid), payStatus: derivePayStatus(r.charged, r.paid),
  }));
}

export async function recordPayment(input: RecordPaymentInput): Promise<PaymentBalance> {
  const { data, error } = await createClient().rpc("record_payment", {
    p_unit_id: input.unitId, p_period: input.period, p_amount: input.amount,
    p_method: input.method, p_kind: input.kind,
    p_memo: input.memo ?? null, p_paid_at: input.paidAt ?? null, p_fee: input.fee ?? 0,
  });
  if (error) throw new Error(error.message);
  const r = data as BalanceDb;
  return { charged: r.charged, paid: r.paid, unpaid: r.unpaid };
}

export async function cancelPayment(paymentId: number): Promise<PaymentBalance> {
  const { data, error } = await createClient().rpc("cancel_payment", { p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  const r = data as BalanceDb;
  return { charged: r.charged, paid: r.paid, unpaid: r.unpaid };
}

export async function listUnitPayments(unitId: number, period: string): Promise<UnitPayment[]> {
  const { data, error } = await createClient().rpc("list_unit_payments", { p_unit_id: unitId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as UnitPaymentDb[]).map((r) => ({
    id: r.id, amount: r.amount, fee: r.fee ?? 0, method: r.method, kind: r.kind,
    memo: r.memo, paidAt: r.paid_at, status: r.status, createdAt: r.created_at,
  }));
}
export interface BuildingPaymentDate {
  unitId: number;
  period: string;
  paidAt: string;
}

export async function getPaymentReceiverName(paymentId: number): Promise<string | null> {
  const supabase = createClient();
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("created_by")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError) throw new Error(paymentError.message);
  if (!payment?.created_by) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", payment.created_by)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  return profile?.full_name ?? null;
}

export async function listBuildingPaymentDates(
  buildingId: number,
  startPeriod: string,
  endPeriod: string,
): Promise<BuildingPaymentDate[]> {
  const { data, error } = await createClient()
    .from("payments")
    .select("unit_id, period, paid_at, units!inner(building_id)")
    .eq("units.building_id", buildingId)
    .eq("status", "active")
    .gte("period", startPeriod)
    .lte("period", endPeriod)
    .order("paid_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    unit_id: number;
    period: string;
    paid_at: string;
  }>).map((row) => ({
    unitId: row.unit_id,
    period: row.period,
    paidAt: row.paid_at,
  }));
}

export async function listGiroPayments(buildingId: number, period: string): Promise<GiroPayment[]> {
  const { data, error } = await createClient().rpc("list_giro_payments", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as GiroPaymentDb[]).map((r) => ({
    id: r.id, unitNo: r.unit_no, dong: r.dong, tenantName: r.tenant_name,
    amount: r.amount, paidAt: r.paid_at, status: r.status, memo: r.memo,
  }));
}

export async function recordBankPayments(
  buildingId: number, period: string, entries: BankPaymentEntry[],
): Promise<{ recorded: number; skipped: number }> {
  const { data, error } = await createClient().rpc("record_bank_payments", {
    p_building_id: buildingId, p_period: period,
    p_entries: entries.map((e) => ({ unit_id: e.unitId, amount: e.amount, paid_at: e.paidAt ?? null, memo: e.memo ?? null })),
  });
  if (error) throw new Error(error.message);
  const r = data as { recorded: number; skipped: number };
  return { recorded: r.recorded, skipped: r.skipped };
}

export async function listBankPayments(buildingId: number, period: string): Promise<BankPaymentRef[]> {
  const { data, error } = await createClient().rpc("list_bank_payments", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { unit_id: number; amount: number; paid_at: string }[])
    .map((r) => ({ unitId: r.unit_id, amount: r.amount, paidAt: r.paid_at }));
}

export function cmsDownloadUrl(buildingId: number, period: string): string {
  const params = new URLSearchParams({ buildingId: String(buildingId), period });
  return `/api/payment/cms?${params.toString()}`;
}
