import { createClient } from "@/lib/supabase/client";
import type { BillItem, BillNameDisplay } from "@/lib/bill/document";

export interface BillTarget {
  unitId: number; unitNo: string; dong: string | null; occupancyId: number | null;
  tenantName: string | null; payerName: string | null; payerNo: string | null;
  billNameDisplay: BillNameDisplay; phone: string | null; secondaryPhone: string | null; faxNumber: string | null;
  totalAmount: number; autoDebit: boolean; transferMethod: string;
  issueType: string | null; dueDate: string | null; sendStatus: string | null; issuedAt: string | null;
  singlePrint: boolean; waterCutoff: boolean; scheduledAt: string | null; messageScheduleId: number | null;
  kakaoSendStatus: string | null; faxSendStatus: string | null;
}
type BillTargetDbRow = {
  unit_id: number; unit_no: string; dong: string | null; occupancy_id: number | null;
  tenant_name: string | null; phone: string | null; phone2: string | null; fax_number: string | null;
  total_amount: number; auto_debit: boolean; transfer_method: string;
  issue_type: string | null; due_date: string | null; send_status: string | null; issued_at: string | null;
  single_print: boolean; water_cutoff: boolean; scheduled_at: string | null; message_schedule_id: number | null;
  kakao_send_status: string | null; fax_send_status: string | null;
};
type BillTargetEnrichment = Pick<BillTarget, "payerName" | "payerNo" | "billNameDisplay">;
const defaultTargetEnrichment: BillTargetEnrichment = {
  payerName: null,
  payerNo: null,
  billNameDisplay: "name",
};
const rowToTarget = (
  r: BillTargetDbRow,
  enrichment: BillTargetEnrichment = defaultTargetEnrichment,
): BillTarget => ({
  unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, occupancyId: r.occupancy_id,
  tenantName: r.tenant_name, phone: r.phone, secondaryPhone: r.phone2, faxNumber: r.fax_number, ...enrichment,
  totalAmount: r.total_amount, autoDebit: r.auto_debit, transferMethod: r.transfer_method ?? "none",
  issueType: r.issue_type, dueDate: r.due_date, sendStatus: r.send_status, issuedAt: r.issued_at,
  singlePrint: r.single_print, waterCutoff: r.water_cutoff,
  scheduledAt: r.scheduled_at, messageScheduleId: r.message_schedule_id,
  kakaoSendStatus: r.kakao_send_status, faxSendStatus: r.fax_send_status,
});

export interface BillDocument {
  unitId: number; unitNo: string; dong: string | null; tenantName: string | null;
  totalAmount: number; autoDebit: boolean; items: BillItem[]; billingNote: string | null; unitNotice: string | null;
}
type BillDocDbItem = { fee_item_id: number; name: string; charged: boolean; amount: number };
type BillDocDbRow = {
  unit_id: number; unit_no: string; dong: string | null; tenant_name: string | null;
  total_amount: number; auto_debit: boolean; items: BillDocDbItem[] | null; billing_note: string | null; unit_notice: string | null;
};
const rowToDoc = (r: BillDocDbRow): BillDocument => ({
  unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, tenantName: r.tenant_name,
  totalAmount: r.total_amount, autoDebit: r.auto_debit,
  items: (r.items ?? []).map((i) => ({ feeItemId: i.fee_item_id, name: i.name, charged: i.charged, amount: i.amount })),
  billingNote: r.billing_note, unitNotice: r.unit_notice,
});

export async function listBillTargets(buildingId: number, period: string): Promise<BillTarget[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_bill_targets", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as BillTargetDbRow[];
  if (rows.length === 0) return [];

  const occupancyIds = [...new Set(rows
    .map((row) => row.occupancy_id)
    .filter((id): id is number => id !== null))];
  const unitIds = [...new Set(rows.map((row) => row.unit_id))];

  type OccupancyBillFields = {
    id: number;
    payer_name: string | null;
    bill_name_display: BillNameDisplay | null;
  };
  // Keep occupancy-owned print fields as a separate enrichment so the bill RPC
  // remains compatible with already-deployed versions.
  const occupancyQuery = occupancyIds.length > 0
    ? supabase
      .from("occupancies")
      .select("id, payer_name, bill_name_display")
      .in("id", occupancyIds)
    : null;
  const [occupancyResult, accountResult] = await Promise.all([
    occupancyQuery,
    supabase
      .from("unit_accounts")
      .select("unit_id, payer_no")
      .eq("kind", "mgmt")
      .in("unit_id", unitIds),
  ]);
  if (occupancyResult?.error) throw new Error(occupancyResult.error.message);
  if (accountResult.error) throw new Error(accountResult.error.message);
  const occupancyRows = (occupancyResult?.data ?? []) as OccupancyBillFields[];

  const occupancyFields = new Map<number, Omit<OccupancyBillFields, "id">>(
    occupancyRows.map(({ id, ...fields }) => [id, fields]),
  );
  const payerNumbers = new Map<number, string | null>(
    ((accountResult.data ?? []) as { unit_id: number; payer_no: string | null }[])
      .map((row) => [row.unit_id, row.payer_no]),
  );
  return rows.map((row) => {
    const occupancy = row.occupancy_id === null
      ? undefined
      : occupancyFields.get(row.occupancy_id);
    return rowToTarget(row, {
      payerName: occupancy?.payer_name ?? null,
      billNameDisplay: occupancy?.bill_name_display ?? "name",
      payerNo: payerNumbers.get(row.unit_id) ?? null,
    });
  });
}

export async function getBillDocuments(buildingId: number, period: string, unitIds: number[]): Promise<BillDocument[]> {
  const { data, error } = await createClient().rpc("get_bill_documents", { p_building_id: buildingId, p_period: period, p_unit_ids: unitIds });
  if (error) throw new Error(error.message);
  return ((data ?? []) as BillDocDbRow[]).map(rowToDoc);
}

export interface IssueBillsPayload {
  buildingId: number; period: string; unitIds: number[]; issueType: string; dueDate: string | null; unitLabelMode: "code" | "name";
  waterCutoffUnitIds?: number[];
}

export async function issueBills(p: IssueBillsPayload): Promise<{ count: number }> {
  const { data, error } = await createClient().rpc("issue_bills", {
    p_building_id: p.buildingId, p_period: p.period, p_unit_ids: p.unitIds,
    p_issue_type: p.issueType, p_due_date: p.dueDate, p_unit_label_mode: p.unitLabelMode,
    ...(p.waterCutoffUnitIds === undefined ? {} : { p_water_cutoff_unit_ids: p.waterCutoffUnitIds }),
  });
  if (error) throw new Error(error.message);
  const r = (data ?? { count: 0 }) as { count: number };
  return { count: r.count };
}

// queued=접수 완료(결과 확인 중), partial=일부 성공. 접수만으로 sent로 기록하지 않는다.
export type BillDeliveryStatus =
  | "scheduled"
  | "queued"
  | "sent"
  | "partial"
  | "failed";

export interface RecordBillDeliveryPayload {
  buildingId: number;
  period: string;
  unitIds: number[];
  issueType: "kakao" | "fax";
  sendStatus: BillDeliveryStatus;
  messageLogId?: number | null;
  messageScheduleId?: number | null;
  scheduledAt?: string | null;
}

export async function recordBillDelivery(p: RecordBillDeliveryPayload): Promise<{ count: number }> {
  const { data, error } = await createClient().rpc("record_bill_delivery", {
    p_building_id: p.buildingId,
    p_period: p.period,
    p_unit_ids: p.unitIds,
    p_issue_type: p.issueType,
    p_send_status: p.sendStatus,
    p_message_log_id: p.messageLogId ?? null,
    p_message_schedule_id: p.messageScheduleId ?? null,
    p_scheduled_at: p.scheduledAt ?? null,
  });
  if (error) throw new Error(error.message);
  const result = (data ?? { count: 0 }) as { count: number };
  return { count: result.count };
}

export interface SendBillFaxesPayload {
  buildingId: number;
  period: string;
  unitIds: number[];
  /** 사용자가 수신번호를 직접 고친 경우에만. 지정하면 선택 세대 전부 이 번호로 보낸다. */
  recipientOverride?: string;
}

/**
 * 고지서 팩스 발송: 대상 fax bill_issue를 확보한 뒤 서버 라우트로 접수한다.
 * 접수 결과({queued, failed})만 반환하며 성공 확정은 재조회 정산이 담당한다(가짜 sent 기록 없음).
 */
export async function sendBillFaxes(
  p: SendBillFaxesPayload,
): Promise<{ queued: number; failed: number }> {
  const { data, error } = await createClient().rpc("resolve_fax_bill_issues", {
    p_building_id: p.buildingId,
    p_period: p.period,
    p_unit_ids: p.unitIds,
  });
  if (error) throw new Error(error.message);
  const billIssueIds = ((data ?? []) as { bill_issue_id: number }[]).map((row) => row.bill_issue_id);
  if (billIssueIds.length === 0) return { queued: 0, failed: 0 };

  const res = await fetch("/api/bill/fax/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ billIssueIds, recipientOverride: p.recipientOverride }),
  });
  const result = (await res.json().catch(() => null)) as
    | { queued?: number; failed?: number; error?: string; message?: string }
    | null;
  if (!res.ok) {
    throw new Error(result?.message ?? result?.error ?? "팩스 발송에 실패했습니다.");
  }
  return { queued: result?.queued ?? 0, failed: result?.failed ?? 0 };
}

export async function getOrganizationName(orgId: number): Promise<string | null> {
  const { data, error } = await createClient()
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.name ?? null;
}
