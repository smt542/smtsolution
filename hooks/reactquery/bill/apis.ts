import { createClient } from "@/lib/supabase/client";
import type { BillItem, BillNameDisplay } from "@/lib/bill/document";

export interface BillTarget {
  unitId: number; unitNo: string; dong: string | null; occupancyId: number | null;
  tenantName: string | null; payerName: string | null; payerNo: string | null;
  billNameDisplay: BillNameDisplay; phone: string | null;
  totalAmount: number; autoDebit: boolean;
  issueType: string | null; dueDate: string | null; sendStatus: string | null; issuedAt: string | null;
}
type BillTargetDbRow = {
  unit_id: number; unit_no: string; dong: string | null; occupancy_id: number | null;
  tenant_name: string | null; phone: string | null; total_amount: number; auto_debit: boolean;
  issue_type: string | null; due_date: string | null; send_status: string | null; issued_at: string | null;
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
  tenantName: r.tenant_name, phone: r.phone, ...enrichment,
  totalAmount: r.total_amount, autoDebit: r.auto_debit,
  issueType: r.issue_type, dueDate: r.due_date, sendStatus: r.send_status, issuedAt: r.issued_at,
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
  let occupancyRows: OccupancyBillFields[] = [];
  if (occupancyIds.length > 0) {
    // Keep occupancy-owned print fields as a separate enrichment so the bill RPC
    // remains compatible with already-deployed versions.
    const occupancyResult = await supabase
      .from("occupancies")
      .select("id, payer_name, bill_name_display")
      .in("id", occupancyIds);
    if (occupancyResult.error) throw new Error(occupancyResult.error.message);
    occupancyRows = (occupancyResult.data ?? []) as OccupancyBillFields[];
  }

  const accountResult = await supabase
    .from("unit_accounts")
    .select("unit_id, payer_no")
    .eq("kind", "mgmt")
    .in("unit_id", unitIds);
  if (accountResult.error) throw new Error(accountResult.error.message);

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
}

export async function issueBills(p: IssueBillsPayload): Promise<{ count: number }> {
  const { data, error } = await createClient().rpc("issue_bills", {
    p_building_id: p.buildingId, p_period: p.period, p_unit_ids: p.unitIds,
    p_issue_type: p.issueType, p_due_date: p.dueDate, p_unit_label_mode: p.unitLabelMode,
  });
  if (error) throw new Error(error.message);
  const r = (data ?? { count: 0 }) as { count: number };
  return { count: r.count };
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
