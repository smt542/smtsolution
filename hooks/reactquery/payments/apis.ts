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
  id: number; unitId: number; buildingId: number; buildingName: string;
  unitNo: string; dong: string | null; tenantName: string | null;
  amount: number; paidAt: string; status: "active" | "canceled"; memo: string | null;
}
export interface GiroPaymentDetail {
  id: number; fee: number; buildingCode: string | null;
}
export interface BankPaymentEntry { unitId: number; amount: number; paidAt: string | null; memo?: string | null; }
export interface BankPaymentRef { unitId: number; amount: number; paidAt: string; }
export interface GiroPaymentEntry {
  unitId: number;
  period: string;
  amount: number;
  fee: number;
  paidAt: string;
  externalRef: string;
}
export interface RecordGiroPaymentsResult {
  recorded: number;
  duplicate: number;
  skipped: number;
  results: Array<{
    index: number;
    externalRef: string | null;
    status: "recorded" | "duplicate" | "skipped";
  }>;
}
export interface PaidDatePayment { amount: number; method: PaymentMethod; paidAt: string; }

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
  id: number; unit_id: number; unit_no: string; dong: string | null;
  building_id: number; building_name: string; tenant_name: string | null;
  amount: number; paid_at: string; status: "active" | "canceled"; memo: string | null;
};
type GiroPaymentDetailDb = {
  id: number;
  fee: number | null;
  units: { buildings: { code: string | null } | null } | null;
};
type PaidDatePaymentDb = {
  amount: number;
  method: PaymentMethod;
  paid_at: string;
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

export interface RecordPaymentEditInput extends RecordPaymentInput {
  oldPaymentId: number;
}

/** 수납 수정 = 기존 취소 + 재기록을 단일 트랜잭션(record_payment_edit)으로 원자 처리. */
export async function recordPaymentEdit(input: RecordPaymentEditInput): Promise<PaymentBalance> {
  const { data, error } = await createClient().rpc("record_payment_edit", {
    p_old_payment_id: input.oldPaymentId,
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

export async function listGiroPayments(buildingId: number | null, period: string): Promise<GiroPayment[]> {
  const { data, error } = await createClient().rpc("list_giro_payments", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as GiroPaymentDb[]).map((r) => ({
    id: r.id, unitId: r.unit_id, buildingId: r.building_id, buildingName: r.building_name,
    unitNo: r.unit_no, dong: r.dong, tenantName: r.tenant_name,
    amount: r.amount, paidAt: r.paid_at, status: r.status, memo: r.memo,
  }));
}

/**
 * PostgREST는 한 응답을 최대 1,000행(Supabase 기본 max_rows)으로 자른다. 조직 전체를 읽는 조회는
 * 같은 정렬로 1,000행씩 이어 받아 합친다(합계가 조용히 잘리지 않도록).
 */
const PAGE_ROWS = 1000;
async function selectAllPages<T>(
  page: (fromRow: number, toRow: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let fromRow = 0; ; fromRow += PAGE_ROWS) {
    const { data, error } = await page(fromRow, fromRow + PAGE_ROWS - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_ROWS) return rows;
  }
}

/** 지로 원장 보조 정보. RPC가 반환하지 않는 수수료·건물 코드를 payments에서 조회한다. */
export async function listGiroPaymentDetails(period: string): Promise<GiroPaymentDetail[]> {
  const rows = await selectAllPages<GiroPaymentDetailDb>((fromRow, toRow) =>
    createClient()
      .from("payments")
      .select("id, fee, units!inner(buildings!inner(code))")
      .eq("method", "giro")
      .eq("period", period)
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(fromRow, toRow),
  );
  return rows.map((row) => ({
    id: row.id,
    fee: row.fee ?? 0,
    buildingCode: row.units?.buildings?.code ?? null,
  }));
}

/** 조직 전체의 활성 수납을 수납일 기준으로 조회한다. RLS가 조직 범위를 보장한다. */
export async function listPaymentsByPaidDate(
  from: string,
  to: string,
): Promise<PaidDatePayment[]> {
  const rows = await selectAllPages<PaidDatePaymentDb>((fromRow, toRow) =>
    createClient()
      .from("payments")
      .select("amount, method, paid_at, units!inner(deleted_at, buildings!inner(deleted_at))")
      .eq("status", "active")
      .gte("paid_at", from)
      .lte("paid_at", to)
      .is("units.deleted_at", null)
      .is("units.buildings.deleted_at", null)
      .order("paid_at", { ascending: true })
      .order("id", { ascending: true })
      .range(fromRow, toRow),
  );
  return rows.map((row) => ({
    amount: row.amount,
    method: row.method,
    paidAt: row.paid_at,
  }));
}

export async function recordBankPayments(
  buildingId: number | null, period: string, entries: BankPaymentEntry[],
): Promise<{ recorded: number; skipped: number; duplicate: number }> {
  const { data, error } = await createClient().rpc("record_bank_payments", {
    p_building_id: buildingId, p_period: period,
    p_entries: entries.map((e) => ({ unit_id: e.unitId, amount: e.amount, paid_at: e.paidAt ?? null, memo: e.memo ?? null })),
  });
  if (error) throw new Error(error.message);
  // duplicate = 서버 멱등 스킵(이미 반영된 동일 입금). skipped는 무효행 포함 합계.
  const r = data as { recorded: number; skipped: number; duplicate?: number };
  return { recorded: r.recorded, skipped: r.skipped, duplicate: r.duplicate ?? 0 };
}

export async function recordGiroPayments(
  entries: GiroPaymentEntry[],
): Promise<RecordGiroPaymentsResult> {
  const { data, error } = await createClient().rpc("record_giro_payments", {
    p_entries: entries.map((entry) => ({
      unit_id: entry.unitId,
      period: entry.period,
      amount: entry.amount,
      fee: entry.fee,
      paid_at: entry.paidAt,
      external_ref: entry.externalRef,
    })),
  });
  if (error) throw new Error(error.message);
  const result = data as {
    recorded: number;
    duplicate: number;
    skipped: number;
    results?: Array<{
      index: number;
      external_ref: string | null;
      status: "recorded" | "duplicate" | "skipped";
    }>;
  };
  return {
    recorded: Number(result.recorded ?? 0),
    duplicate: Number(result.duplicate ?? 0),
    skipped: Number(result.skipped ?? 0),
    results: (result.results ?? []).map((item) => ({
      index: item.index,
      externalRef: item.external_ref,
      status: item.status,
    })),
  };
}

export async function listBankPayments(buildingId: number | null, period: string): Promise<BankPaymentRef[]> {
  const { data, error } = await createClient().rpc("list_bank_payments", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { unit_id: number; amount: number; paid_at: string }[])
    .map((r) => ({ unitId: r.unit_id, amount: r.amount, paidAt: r.paid_at }));
}

export function cmsDownloadUrl(buildingId: number, period: string): string {
  const params = new URLSearchParams({ buildingId: String(buildingId), period });
  return `/api/payment/cms?${params.toString()}`;
}
