import { createClient } from "@/lib/supabase/client";
import type { SettlementInquiryType } from "./inquiryTypes";

export type RepairAttribution = "owner" | "manager" | "office";
export type SettlementStatus = "draft" | "saved" | "mid_moveout" | "completed";
export type OccupancyStatus = "occupied" | "vacant" | "moving_out";
export type SettlementUtility = "water" | "elec" | "gas";

export interface MovingSettlement {
  id: number;
  unitId: number;
  occupancyId: number | null;
  moveOutDate: string | null;
  mgmtFeeMonthly: number | null;
  mgmtFeeProrated: number | null;
  waterCharge: number | null;
  elecCharge: number | null;
  gasCharge: number | null;
  elecPaidDate: string | null;
  gasPaidDate: string | null;
  repairAmount: number | null;
  repairAttribution: RepairAttribution | null;
  repairMemo: string | null;
  settleBank: string | null;
  settleAcct: string | null;
  settleHolder: string | null;
  settlementAmount: number | null;
  note: string | null;
  settlementNote: string | null;
  status: SettlementStatus;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeterSummary {
  utility: SettlementUtility;
  previousReading: number | null;
  currentReading: number | null;
  usage: number | null;
}

export interface ChecklistItem {
  id: number;
  label: string;
  checked: boolean;
}

export interface SettlementContext {
  unit: {
    id: number;
    unitNo: string;
    dong: string | null;
    buildingId: number;
    buildingName: string;
  };
  occupancy: {
    id: number;
    tenantName: string | null;
    phone: string | null;
    alimtalkOptIn: boolean;
    moveInDate: string | null;
    settlementNote: string | null;
    billingNote: string | null;
    status: OccupancyStatus;
  } | null;
  latestSettlement: MovingSettlement | null;
  settleAccount: {
    settleBank: string | null;
    settleAcct: string | null;
    settleHolder: string | null;
  };
  checklist: ChecklistItem[];
  meterSummary: MeterSummary[];
}

export interface SaveSettlementData {
  moveOutDate: string;
  mgmtFeeMonthly: number | null;
  mgmtFeeProrated: number | null;
  waterCharge: number | null;
  elecCharge: number | null;
  gasCharge: number | null;
  elecPaidDate: string | null;
  gasPaidDate: string | null;
  repairAmount: number | null;
  repairAttribution: RepairAttribution | null;
  repairMemo: string | null;
  settleBank: string | null;
  settleAcct: string | null;
  settleHolder: string | null;
  note: string | null;
  settlementNote: string | null;
}

export interface SaveSettlementInput {
  unitId: number;
  occupancyId: number | null;
  settlementId: number | null;
  data: SaveSettlementData;
  checklist: { checkItemId: number; checked: boolean }[];
}

export interface SettlementListRow {
  settlementId: number;
  unitId: number;
  occupancyId: number | null;
  unitNo: string;
  tenantName: string | null;
  status: SettlementStatus;
  settlementAmount: number | null;
  moveOutDate: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface SettlementInquiryParams {
  type: SettlementInquiryType;
  buildingId?: number;
  from: string;
  to: string;
  search?: string;
  status?: SettlementStatus;
  page?: number;
  pageSize?: number;
}

export interface SettlementInquiryRow {
  settlementId: number;
  buildingId: number;
  buildingName: string;
  unitId: number;
  occupancyId: number | null;
  dong: string | null;
  unitNo: string;
  tenantName: string | null;
  status: SettlementStatus;
  moveOutDate: string | null;
  mgmtFeeProrated: number | null;
  waterCharge: number | null;
  elecCharge: number | null;
  gasCharge: number | null;
  elecPaidDate: string | null;
  gasPaidDate: string | null;
  repairAmount: number | null;
  settlementAmount: number | null;
  processedAt: string | null;
  createdAt: string;
}

export interface SettlementInquiryResult {
  rows: SettlementInquiryRow[];
  total: number;
}

interface MovingSettlementRpc {
  id: number;
  unit_id: number;
  occupancy_id: number | null;
  move_out_date: string | null;
  mgmt_fee_monthly: number | null;
  mgmt_fee_prorated: number | null;
  water_charge: number | null;
  elec_charge: number | null;
  gas_charge: number | null;
  elec_paid_date: string | null;
  gas_paid_date: string | null;
  repair_amount: number | null;
  repair_attribution: RepairAttribution | null;
  repair_memo: string | null;
  settle_bank: string | null;
  settle_acct: string | null;
  settle_holder: string | null;
  settlement_amount: number | null;
  note: string | null;
  settlement_note: string | null;
  status: SettlementStatus;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SettlementContextRpc {
  unit: {
    id: number;
    unit_no: string;
    dong: string | null;
    building_id: number;
    building_name: string;
  };
  occupancy: {
    id: number;
    tenant_name: string | null;
    phone: string | null;
    alimtalk_opt_in: boolean;
    move_in_date: string | null;
    settlement_note: string | null;
    billing_note: string | null;
    status: OccupancyStatus;
  } | null;
  latest_settlement: MovingSettlementRpc | null;
  settle_account: {
    settle_bank: string | null;
    settle_acct: string | null;
    settle_holder: string | null;
  };
  checklist: { id: number; label: string; checked: boolean }[];
  meter_summary: {
    utility: SettlementUtility;
    previous_reading: number | null;
    current_reading: number | null;
    usage: number | null;
  }[];
}

interface SettlementListRpc {
  settlement_id: number;
  unit_id: number;
  occupancy_id: number | null;
  unit_no: string;
  tenant_name: string | null;
  status: SettlementStatus;
  settlement_amount: number | null;
  move_out_date: string | null;
  processed_at: string | null;
  created_at: string;
}

interface SettlementInquiryRpc {
  settlement_id: number;
  building_id: number;
  building_name: string;
  unit_id: number;
  occupancy_id: number | null;
  dong: string | null;
  unit_no: string;
  tenant_name: string | null;
  status: SettlementStatus;
  move_out_date: string | null;
  mgmt_fee_prorated: number | null;
  water_charge: number | null;
  elec_charge: number | null;
  gas_charge: number | null;
  elec_paid_date: string | null;
  gas_paid_date: string | null;
  repair_amount: number | null;
  settlement_amount: number | null;
  processed_at: string | null;
  created_at: string;
  total_count: unknown;
}

function rpcToMovingSettlement(r: MovingSettlementRpc): MovingSettlement {
  return {
    id: r.id,
    unitId: r.unit_id,
    occupancyId: r.occupancy_id,
    moveOutDate: r.move_out_date,
    mgmtFeeMonthly: r.mgmt_fee_monthly,
    mgmtFeeProrated: r.mgmt_fee_prorated,
    waterCharge: r.water_charge,
    elecCharge: r.elec_charge,
    gasCharge: r.gas_charge,
    elecPaidDate: r.elec_paid_date,
    gasPaidDate: r.gas_paid_date,
    repairAmount: r.repair_amount,
    repairAttribution: r.repair_attribution,
    repairMemo: r.repair_memo,
    settleBank: r.settle_bank,
    settleAcct: r.settle_acct,
    settleHolder: r.settle_holder,
    settlementAmount: r.settlement_amount,
    note: r.note,
    settlementNote: r.settlement_note,
    status: r.status,
    processedAt: r.processed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rpcToSettlementContext(r: SettlementContextRpc): SettlementContext {
  return {
    unit: {
      id: r.unit.id,
      unitNo: r.unit.unit_no,
      dong: r.unit.dong,
      buildingId: r.unit.building_id,
      buildingName: r.unit.building_name,
    },
    occupancy: r.occupancy
      ? {
          id: r.occupancy.id,
          tenantName: r.occupancy.tenant_name,
          phone: r.occupancy.phone,
          alimtalkOptIn: r.occupancy.alimtalk_opt_in,
          moveInDate: r.occupancy.move_in_date,
          settlementNote: r.occupancy.settlement_note,
          billingNote: r.occupancy.billing_note,
          status: r.occupancy.status,
        }
      : null,
    latestSettlement: r.latest_settlement
      ? rpcToMovingSettlement(r.latest_settlement)
      : null,
    settleAccount: {
      settleBank: r.settle_account.settle_bank,
      settleAcct: r.settle_account.settle_acct,
      settleHolder: r.settle_account.settle_holder,
    },
    checklist: r.checklist.map((item) => ({
      id: item.id,
      label: item.label,
      checked: item.checked,
    })),
    meterSummary: r.meter_summary.map((meter) => ({
      utility: meter.utility,
      previousReading: meter.previous_reading,
      currentReading: meter.current_reading,
      usage: meter.usage,
    })),
  };
}

function settlementDataToRpc(data: SaveSettlementData) {
  return {
    move_out_date: data.moveOutDate,
    mgmt_fee_monthly: data.mgmtFeeMonthly,
    mgmt_fee_prorated: data.mgmtFeeProrated,
    water_charge: data.waterCharge,
    elec_charge: data.elecCharge,
    gas_charge: data.gasCharge,
    elec_paid_date: data.elecPaidDate,
    gas_paid_date: data.gasPaidDate,
    repair_amount: data.repairAmount,
    repair_attribution: data.repairAttribution,
    repair_memo: data.repairMemo,
    settle_bank: data.settleBank,
    settle_acct: data.settleAcct,
    settle_holder: data.settleHolder,
    note: data.note,
    settlement_note: data.settlementNote,
  };
}

function rpcToSettlementListRow(r: SettlementListRpc): SettlementListRow {
  return {
    settlementId: r.settlement_id,
    unitId: r.unit_id,
    occupancyId: r.occupancy_id,
    unitNo: r.unit_no,
    tenantName: r.tenant_name,
    status: r.status,
    settlementAmount: r.settlement_amount,
    moveOutDate: r.move_out_date,
    processedAt: r.processed_at,
    createdAt: r.created_at,
  };
}

function rpcToSettlementInquiryRow(r: SettlementInquiryRpc): SettlementInquiryRow {
  return {
    settlementId: r.settlement_id,
    buildingId: r.building_id,
    buildingName: r.building_name,
    unitId: r.unit_id,
    occupancyId: r.occupancy_id,
    dong: r.dong,
    unitNo: r.unit_no,
    tenantName: r.tenant_name,
    status: r.status,
    moveOutDate: r.move_out_date,
    mgmtFeeProrated: r.mgmt_fee_prorated,
    waterCharge: r.water_charge,
    elecCharge: r.elec_charge,
    gasCharge: r.gas_charge,
    elecPaidDate: r.elec_paid_date,
    gasPaidDate: r.gas_paid_date,
    repairAmount: r.repair_amount,
    settlementAmount: r.settlement_amount,
    processedAt: r.processed_at,
    createdAt: r.created_at,
  };
}

export function calculateSettlementAmount(values: Pick<
  SaveSettlementData,
  "mgmtFeeProrated" | "waterCharge" | "elecCharge" | "gasCharge" | "repairAmount"
>): number {
  return (
    (values.mgmtFeeProrated ?? 0) +
    (values.waterCharge ?? 0) +
    (values.elecCharge ?? 0) +
    (values.gasCharge ?? 0) +
    (values.repairAmount ?? 0)
  );
}

export async function getSettlementContext(unitId: number): Promise<SettlementContext> {
  const { data, error } = await createClient().rpc("get_settlement_context", {
    p_unit_id: unitId,
  });
  if (error) throw new Error(error.message);
  return rpcToSettlementContext(data as SettlementContextRpc);
}

export async function saveMovingSettlement(
  input: SaveSettlementInput,
): Promise<{ settlementId: number; settlementAmount: number }> {
  const { data, error } = await createClient().rpc("save_moving_settlement", {
    p_unit_id: input.unitId,
    p_occupancy_id: input.occupancyId,
    p_settlement_id: input.settlementId,
    p_data: settlementDataToRpc(input.data),
    p_checklist: input.checklist.map((item) => ({
      check_item_id: item.checkItemId,
      checked: item.checked,
    })),
  });
  if (error) throw new Error(error.message);
  const result = data as { settlement_id: number; settlement_amount: number };
  return {
    settlementId: result.settlement_id,
    settlementAmount: result.settlement_amount,
  };
}

export async function completeMovingSettlement(
  settlementId: number,
): Promise<{ ok: boolean }> {
  const { data, error } = await createClient().rpc("complete_moving_settlement", {
    p_settlement_id: settlementId,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean };
}

export async function midMoveoutSettlement(
  settlementId: number,
): Promise<{ ok: boolean }> {
  const { data, error } = await createClient().rpc("mid_moveout_settlement", {
    p_settlement_id: settlementId,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean };
}

export async function deleteMovingSettlement(settlementId: number): Promise<void> {
  const { error } = await createClient()
    .from("moving_settlements")
    .delete()
    .eq("id", settlementId);
  if (error) throw new Error(error.message);
}

export async function listSettlements(
  buildingId: number,
  from: string,
  to: string,
): Promise<SettlementListRow[]> {
  const { data, error } = await createClient().rpc("list_settlements", {
    p_building_id: buildingId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SettlementListRpc[]).map(rpcToSettlementListRow);
}

export async function listSettlementInquiries(
  params: SettlementInquiryParams,
): Promise<SettlementInquiryResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const { data, error } = await createClient().rpc("list_settlement_inquiries", {
    p_type: params.type === "electric" ? "elec" : params.type,
    p_building_id: params.buildingId ?? null,
    p_from: params.from,
    p_to: params.to,
    p_search: params.search?.trim() || null,
    p_status: params.status ?? null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(error.message);
  const rpcRows = (data ?? []) as SettlementInquiryRpc[];
  return {
    rows: rpcRows.map(rpcToSettlementInquiryRow),
    total: rpcRows.length > 0 ? Number(rpcRows[0].total_count) : 0,
  };
}
