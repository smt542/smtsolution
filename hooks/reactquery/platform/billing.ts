import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { platformKeys } from "./keys";

export type PlatformOrgBillingStatus = "none" | "unpaid" | "paid";
export type PlatformBillingInvoiceStatus = "unpaid" | "paid";

export interface PlatformOrgBilling {
  orgId: number;
  orgName: string;
  orgEmail: string | null;
  status: PlatformOrgBillingStatus;
  alimtalkCount: number;
  smsCount: number;
  lmsCount: number;
  faxCount: number;
  faxPageCount: number;
  subtotalKrw: number;
  vatKrw: number;
  totalKrw: number;
  prevTotalKrw: number;
}

export interface PlatformOverviewMetrics {
  orgActive: number;
  orgSuspended: number;
  orgTerminated: number;
  buildingCount: number;
  buildingAddedThisMonth: number;
  unitCount: number;
  linkedUnitCount: number;
  sendCostKrw: number;
  sendCostPrevKrw: number;
}

export interface PlatformBillingInvoice {
  id: number;
  orgId: number;
  billingMonth: string;
  status: PlatformBillingInvoiceStatus;
  alimtalkCount: number;
  smsCount: number;
  lmsCount: number;
  faxCount: number;
  faxPageCount: number;
  subtotalKrw: number;
  vatKrw: number;
  totalKrw: number;
  issuedAt: string;
  paidAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface MarkOrgBillingPaidInput {
  orgId: number;
  month: string;
  paid: boolean;
}

interface PlatformOrgBillingRow {
  org_id: number;
  org_name: string;
  org_email: string | null;
  status: PlatformOrgBillingStatus;
  alimtalk_count: number;
  sms_count: number;
  lms_count: number;
  fax_count: number;
  fax_page_count: number;
  subtotal_krw: number;
  vat_krw: number;
  total_krw: number;
  prev_total_krw: number;
}

interface PlatformOverviewMetricsRow {
  org_active: number;
  org_suspended: number;
  org_terminated: number;
  building_count: number;
  building_added_this_month: number;
  unit_count: number;
  linked_unit_count: number;
  send_cost_krw: number;
  send_cost_prev_krw: number;
}

interface PlatformBillingInvoiceRow {
  id: number | null;
  org_id: number | null;
  billing_month: string | null;
  status: PlatformBillingInvoiceStatus | null;
  alimtalk_count: number | null;
  sms_count: number | null;
  lms_count: number | null;
  fax_count: number | null;
  fax_page_count: number | null;
  subtotal_krw: number | null;
  vat_krw: number | null;
  total_krw: number | null;
  issued_at: string | null;
  paid_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

function mapOrgBilling(row: PlatformOrgBillingRow): PlatformOrgBilling {
  return {
    orgId: row.org_id,
    orgName: row.org_name,
    orgEmail: row.org_email,
    status: row.status,
    alimtalkCount: row.alimtalk_count,
    smsCount: row.sms_count,
    lmsCount: row.lms_count,
    faxCount: row.fax_count,
    faxPageCount: row.fax_page_count,
    subtotalKrw: Number(row.subtotal_krw),
    vatKrw: Number(row.vat_krw),
    totalKrw: Number(row.total_krw),
    prevTotalKrw: Number(row.prev_total_krw),
  };
}

function mapOverviewMetrics(row: PlatformOverviewMetricsRow): PlatformOverviewMetrics {
  return {
    orgActive: row.org_active,
    orgSuspended: row.org_suspended,
    orgTerminated: row.org_terminated,
    buildingCount: row.building_count,
    buildingAddedThisMonth: row.building_added_this_month,
    unitCount: row.unit_count,
    linkedUnitCount: row.linked_unit_count,
    sendCostKrw: Number(row.send_cost_krw),
    sendCostPrevKrw: Number(row.send_cost_prev_krw),
  };
}

function mapBillingInvoice(row: PlatformBillingInvoiceRow): PlatformBillingInvoice | null {
  if (
    row.id == null
    || row.org_id == null
    || row.billing_month == null
    || row.status == null
    || row.issued_at == null
    || row.updated_at == null
  ) {
    return null;
  }

  return {
    id: row.id,
    orgId: row.org_id,
    billingMonth: row.billing_month,
    status: row.status,
    alimtalkCount: row.alimtalk_count ?? 0,
    smsCount: row.sms_count ?? 0,
    lmsCount: row.lms_count ?? 0,
    faxCount: row.fax_count ?? 0,
    faxPageCount: row.fax_page_count ?? 0,
    subtotalKrw: Number(row.subtotal_krw ?? 0),
    vatKrw: Number(row.vat_krw ?? 0),
    totalKrw: Number(row.total_krw ?? 0),
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function getPlatformOrgBilling(month: string): Promise<PlatformOrgBilling[]> {
  const { data, error } = await createClient().rpc("platform_list_org_billing", {
    p_month: month,
  });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PlatformOrgBillingRow[]).map(mapOrgBilling);
}

export async function getPlatformOverviewMetrics(
  month: string,
): Promise<PlatformOverviewMetrics> {
  const { data, error } = await createClient().rpc("platform_get_overview_metrics", {
    p_month: month,
  });

  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as unknown as
    | PlatformOverviewMetricsRow
    | null;
  if (!row) throw new Error("Overview metrics response was empty.");
  return mapOverviewMetrics(row);
}

export async function markOrgBillingPaid(
  input: MarkOrgBillingPaidInput,
): Promise<PlatformBillingInvoice | null> {
  const { data, error } = await createClient().rpc("platform_mark_org_billing_paid", {
    p_org_id: input.orgId,
    p_month: input.month,
    p_paid: input.paid,
  });

  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as unknown as
    | PlatformBillingInvoiceRow
    | null;
  return row ? mapBillingInvoice(row) : null;
}

export function usePlatformOrgBilling(month: string) {
  return useQuery({
    queryKey: platformKeys.billing(month),
    queryFn: () => getPlatformOrgBilling(month),
  });
}

export function usePlatformOverviewMetrics(month: string) {
  return useQuery({
    queryKey: platformKeys.overviewMetrics(month),
    queryFn: () => getPlatformOverviewMetrics(month),
  });
}

export function useMarkOrgBillingPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markOrgBillingPaid,
    onSuccess: (_invoice, input) => {
      void queryClient.invalidateQueries({ queryKey: platformKeys.billing(input.month) });
      void queryClient.invalidateQueries({
        queryKey: platformKeys.overviewMetrics(input.month),
      });
      void queryClient.invalidateQueries({ queryKey: platformKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: platformKeys.organizations() });
    },
  });
}
