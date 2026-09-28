import { useQueries, useQuery } from "@tanstack/react-query";
import type { BillDocument } from "@/hooks/reactquery/bill";
import type {
  PaymentMethod,
  PaymentKind,
  PaymentRow,
  UnitPayment,
} from "@/hooks/reactquery/payments";
import type { UtilityType, UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { computeUnpaid, derivePayStatus } from "@/lib/payments/status";
import { createClient } from "@/lib/supabase/client";

export const receiptKeys = {
  all: ["receipts"] as const,
  workspace: (orgId: number, period: string) =>
    ["receipts", "workspace", orgId, period] as const,
  statement: (
    buildingId: number,
    unitId: number | null,
    startPeriod: string,
    endPeriod: string,
  ) => [
    "receipts",
    "statement",
    buildingId,
    unitId ?? "building",
    startPeriod,
    endPeriod,
  ] as const,
};

export interface ReceiptPaymentRow extends PaymentRow {
  buildingId: number;
  buildingCode: string;
  buildingName: string;
  phone: string | null;
  overdueMonths: number;
  overdueAmount: number;
  lastPaymentDate: string | null;
}

export interface ReceiptFeeItemAmount {
  buildingId: number;
  buildingName: string;
  feeItemId: number;
  feeItemName: string;
  amount: number;
}

export interface ReceiptPaymentStatusData {
  rows: ReceiptPaymentRow[];
  feeItems: ReceiptFeeItemAmount[];
}

type ReceiptFeeTotalDbRow = {
  fee_item_id: number;
  fee_item_name: string;
  amount: number | string;
};

export interface ReceiptWorkspaceDbRow {
  building_id: number;
  building_code: string;
  building_name: string;
  unit_id: number;
  unit_no: string;
  dong: string | null;
  occupancy_id: number | null;
  tenant_name: string | null;
  is_vacant: boolean;
  is_auto_debit: boolean;
  due_date: string | null;
  payer_no: string | null;
  payer_name: string | null;
  charged: number | null;
  paid: number | string;
  unpaid: number | string | null;
  pay_status: PaymentRow["payStatus"];
  phone: string | null;
  overdue_months: number | string;
  overdue_amount: number | string;
  last_payment_date: string | null;
  fee_item_totals: ReceiptFeeTotalDbRow[] | null;
}

export function mapReceiptWorkspaceRows(
  dbRows: ReceiptWorkspaceDbRow[],
): ReceiptPaymentStatusData {
  const feeItems = new Map<string, ReceiptFeeItemAmount>();

  const rows = dbRows.map((row): ReceiptPaymentRow => {
    for (const item of row.fee_item_totals ?? []) {
      const key = `${row.building_id}:${item.fee_item_id}`;
      if (!feeItems.has(key)) {
        feeItems.set(key, {
          buildingId: row.building_id,
          buildingName: row.building_name,
          feeItemId: item.fee_item_id,
          feeItemName: item.fee_item_name,
          amount: Number(item.amount),
        });
      }
    }

    return {
      unitId: row.unit_id,
      unitNo: row.unit_no,
      dong: row.dong,
      occupancyId: row.occupancy_id,
      tenantName: row.tenant_name,
      isVacant: row.is_vacant,
      isAutoDebit: row.is_auto_debit,
      dueDate: row.due_date,
      payerNo: row.payer_no,
      payerName: row.payer_name,
      charged: row.charged === null ? null : Number(row.charged),
      paid: Number(row.paid),
      unpaid: row.unpaid === null ? null : Number(row.unpaid),
      payStatus: row.pay_status,
      buildingId: row.building_id,
      buildingCode: row.building_code,
      buildingName: row.building_name,
      phone: row.phone,
      overdueMonths: Number(row.overdue_months),
      overdueAmount: Number(row.overdue_amount),
      lastPaymentDate: row.last_payment_date,
    };
  });

  return { rows, feeItems: [...feeItems.values()] };
}

export async function listReceiptPaymentStatus(
  orgId: number,
  period: string,
): Promise<ReceiptPaymentStatusData> {
  const { data, error } = await createClient().rpc("list_receipts_workspace", {
    p_org_id: orgId,
    p_period: period,
  });
  if (error) throw new Error(error.message);
  return mapReceiptWorkspaceRows((data ?? []) as ReceiptWorkspaceDbRow[]);
}

const EMPTY_PAYMENT_STATUS: ReceiptPaymentStatusData = { rows: [], feeItems: [] };

export function useReceiptPaymentStatus(
  orgId: number,
  period: string,
  enabled = true,
) {
  const query = useQuery({
    queryKey: receiptKeys.workspace(orgId, period),
    queryFn: () => listReceiptPaymentStatus(orgId, period),
    enabled: enabled && orgId > 0 && Boolean(period),
  });
  return { ...query, data: query.data ?? EMPTY_PAYMENT_STATUS };
}

export function useReceiptPaymentStatusPeriods(
  orgId: number,
  periods: string[],
  enabled: boolean,
) {
  const queries = useQueries({
    queries: periods.map((period) => ({
      queryKey: receiptKeys.workspace(orgId, period),
      queryFn: () => listReceiptPaymentStatus(orgId, period),
      enabled: enabled && orgId > 0 && Boolean(period),
    })),
  });

  return {
    periods: periods.map((period, index) => ({
      period,
      rows: queries[index]?.data?.rows ?? [],
    })),
    isLoading: enabled && queries.some((query) => query.isLoading),
  };
}

interface StatementPaymentRowDb {
  period: string;
  unit_id: number;
  unit_no: string;
  dong: string | null;
  occupancy_id: number | null;
  tenant_name: string | null;
  is_vacant: boolean;
  is_auto_debit: boolean;
  due_date: string | null;
  charged: number | null;
  paid: number | string;
  payer_no: string | null;
  payer_name: string | null;
}

interface StatementPaymentDb {
  id: number;
  unit_id: number;
  period: string;
  amount: number | string;
  fee: number | string;
  method: PaymentMethod;
  kind: PaymentKind;
  memo: string | null;
  paid_at: string;
  status: "active" | "canceled";
  created_at: string;
}

interface StatementDocumentDb {
  period: string;
  unit_id: number;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  total_amount: number | string;
  auto_debit: boolean;
  items: Array<{
    fee_item_id: number;
    name: string;
    charged: boolean;
    amount: number | string;
  }> | null;
  billing_note: string | null;
  unit_notice: string | null;
}

interface StatementUtilityDb {
  period: string;
  unit_id: number;
  unit_no: string;
  dong: string | null;
  occupancy_id: number | null;
  tenant_name: string | null;
  occupancy_status: UtilityUnitRow["occupancyStatus"];
  move_in_date: string | null;
  customer_no: string | null;
  meter_no: string | null;
  previous_reading: number | string | null;
  current_reading: number | string | null;
  usage: number | string | null;
  unit_price: number | string | null;
  resolved_unit_price: number | string | null;
  calc_charge: number | string | null;
  manual_charge: number | string | null;
  note: string | null;
  processed_at: string | null;
  discount_type: string | null;
  discount_amount: number | string | null;
}

interface StatementRpcResponse {
  payment_rows?: StatementPaymentRowDb[];
  payments?: StatementPaymentDb[];
  documents?: StatementDocumentDb[];
  utilities?: Partial<Record<UtilityType, StatementUtilityDb[]>>;
}

export interface ReceiptStatementPaymentRow extends PaymentRow {
  period: string;
}

export interface ReceiptStatementPayment extends UnitPayment {
  unitId: number;
  period: string;
}

export interface ReceiptStatementDocument extends BillDocument {
  period: string;
}

export interface ReceiptStatementUtilityRow extends UtilityUnitRow {
  period: string;
}

export interface ReceiptStatementData {
  paymentRows: ReceiptStatementPaymentRow[];
  payments: ReceiptStatementPayment[];
  documents: ReceiptStatementDocument[];
  utilities: Record<UtilityType, ReceiptStatementUtilityRow[]>;
}

const nullableNumber = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

function mapStatementData(response: StatementRpcResponse): ReceiptStatementData {
  const paymentRows = (response.payment_rows ?? []).map((row) => {
    const charged = nullableNumber(row.charged);
    const paid = Number(row.paid);
    return {
      period: row.period,
      unitId: row.unit_id,
      unitNo: row.unit_no,
      dong: row.dong,
      occupancyId: row.occupancy_id,
      tenantName: row.tenant_name,
      isVacant: row.is_vacant,
      isAutoDebit: row.is_auto_debit,
      dueDate: row.due_date,
      payerNo: row.payer_no,
      payerName: row.payer_name,
      charged,
      paid,
      unpaid: computeUnpaid(charged, paid),
      payStatus: derivePayStatus(charged, paid),
    };
  });
  const payments = (response.payments ?? []).map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    period: row.period,
    amount: Number(row.amount),
    fee: Number(row.fee),
    method: row.method,
    kind: row.kind,
    memo: row.memo,
    paidAt: row.paid_at,
    status: row.status,
    createdAt: row.created_at,
  }));
  const documents = (response.documents ?? []).map((row) => ({
    period: row.period,
    unitId: row.unit_id,
    unitNo: row.unit_no,
    dong: row.dong,
    tenantName: row.tenant_name,
    totalAmount: Number(row.total_amount),
    autoDebit: row.auto_debit,
    items: (row.items ?? []).map((item) => ({
      feeItemId: item.fee_item_id,
      name: item.name,
      charged: item.charged,
      amount: Number(item.amount),
    })),
    billingNote: row.billing_note,
    unitNotice: row.unit_notice,
  }));
  const utilities = Object.fromEntries(
    (["electricity", "water", "gas"] as UtilityType[]).map((type) => [
      type,
      (response.utilities?.[type] ?? []).map((row) => ({
        period: row.period,
        unitId: row.unit_id,
        unitNo: row.unit_no,
        dong: row.dong,
        occupancyId: row.occupancy_id,
        tenantName: row.tenant_name,
        occupancyStatus: row.occupancy_status,
        moveInDate: row.move_in_date,
        customerNumber: row.customer_no,
        meterNumber: row.meter_no,
        previousReading: nullableNumber(row.previous_reading),
        currentReading: nullableNumber(row.current_reading),
        usage: nullableNumber(row.usage),
        unitPrice: nullableNumber(row.unit_price),
        resolvedUnitPrice: nullableNumber(row.resolved_unit_price),
        automaticCharge: nullableNumber(row.calc_charge),
        manualCharge: nullableNumber(row.manual_charge),
        note: row.note,
        processedAt: row.processed_at,
        discountType: row.discount_type,
        discountAmount: nullableNumber(row.discount_amount),
      })),
    ]),
  ) as Record<UtilityType, ReceiptStatementUtilityRow[]>;

  return { paymentRows, payments, documents, utilities };
}

export async function getReceiptStatementData(
  buildingId: number,
  unitId: number | null,
  startPeriod: string,
  endPeriod: string,
): Promise<ReceiptStatementData> {
  const { data, error } = await createClient().rpc("get_payment_statement_data", {
    p_building_id: buildingId,
    p_unit_id: unitId,
    p_start_period: startPeriod,
    p_end_period: endPeriod,
  });
  if (error) throw new Error(error.message);
  return mapStatementData((data ?? {}) as StatementRpcResponse);
}

export function useReceiptStatementData(
  buildingId: number,
  unitId: number | null,
  startPeriod: string,
  endPeriod: string,
  enabled = true,
) {
  return useQuery({
    queryKey: receiptKeys.statement(buildingId, unitId, startPeriod, endPeriod),
    queryFn: () => getReceiptStatementData(
      buildingId,
      unitId,
      startPeriod,
      endPeriod,
    ),
    enabled: enabled && buildingId > 0 && Boolean(startPeriod) && Boolean(endPeriod),
  });
}
