import { createClient } from "@/lib/supabase/client";
import type { SettlementInquiryType } from "./inquiryTypes";

export type RepairAttribution = "owner" | "manager" | "office";
export type SettlementStatus = "draft" | "saved" | "mid_moveout" | "completed";
export type SettlementInquiryStatus = SettlementStatus | "incomplete";
export type SettlementInquirySort = "code" | "date";
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
  /** 그 달 검침에 적용된 단가(표시용). 할인·수동보정이 있으면 unitPrice x usage != charge 다. */
  unitPrice: number | null;
  /** 수도 할인 등 그 달 검침의 할인액. charge 에 이미 반영돼 있다. */
  discountAmount: number | null;
  /**
   * 그 달 검침의 실효 요금 = coalesce(manual_charge, calc_charge).
   * `calc_charge` 자체가 `usage x unit_price - discount` 이므로 여기에 다시 곱하면 안 된다.
   * 단가 반영 ON 이면 이 값을 공과금 금액으로 쓴다(0169).
   */
  charge: number | null;
  usage: number | null;
}

/** /staff/setup?tab=settlement 의 이사정산 설정. 0167 에서 get_settlement_context 가 동봉한다. */
export interface SettlementSettings {
  waterUnitReflect: boolean;
  electricUnitReflect: boolean;
  vacancyPaymentMode: "manual" | "auto";
}

export interface ChecklistItem {
  id: number;
  label: string;
  checked: boolean;
  /** 항목별 메모(0172). staff 화면의 입력값이고 checked 는 이 값이 비어있지 않은지로 파생된다. */
  note: string | null;
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
  settlementSettings: SettlementSettings;
  /**
   * billing 미납액 = 확정 부과된 period 의 (부과액 - 유효수납) 합(0171).
   * 정산건 미수금(정산금액 - 수납액)과는 **다른 숫자**다. 완료 가드는 둘 다 본다.
   */
  billingUnpaid: number;
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
  checklist: { checkItemId: number; checked: boolean; note: string | null }[];
}

export interface SavePartnerSettlementInput {
  unitId: number;
  occupancyId: number | null;
  settlementId: number | null;
  data: Record<string, unknown>;
  checklist: { check_item_id: number; checked: boolean }[];
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
  appliedFrom?: string;
  search?: string;
  status?: SettlementInquiryStatus;
  sort?: SettlementInquirySort;
  page?: number;
  pageSize?: number;
}

export interface SettlementInquiryRow {
  settlementId: number;
  buildingId: number;
  buildingCode: string;
  buildingName: string;
  buildingAddress: string | null;
  unitId: number;
  occupancyId: number | null;
  dong: string | null;
  unitNo: string;
  tenantName: string | null;
  status: SettlementStatus;
  moveOutDate: string | null;
  moveInDate: string | null;
  mgmtFeeProrated: number | null;
  waterCharge: number | null;
  elecCharge: number | null;
  gasCharge: number | null;
  meterNo: string | null;
  customerNo: string | null;
  elecPreviousReading: number | null;
  elecCurrentReading: number | null;
  elecUsage: number | null;
  gasPreviousReading: number | null;
  gasCurrentReading: number | null;
  gasUsage: number | null;
  waterPreviousReading: number | null;
  waterCurrentReading: number | null;
  waterUsage: number | null;
  elecPaidDate: string | null;
  gasPaidDate: string | null;
  waterPaidDate: string | null;
  repairAmount: number | null;
  cleaningCost: number | null;
  checkedByName: string | null;
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
  settlement_settings: {
    water_unit_reflect: boolean;
    electric_unit_reflect: boolean;
    vacancy_payment_mode: "manual" | "auto";
  } | null;
  billing_unpaid: number | string | null;
  checklist: { id: number; label: string; checked: boolean; note: string | null }[];
  meter_summary: {
    utility: SettlementUtility;
    previous_reading: number | null;
    current_reading: number | null;
    unit_price: number | null;
    discount_amount: number | null;
    charge: number | null;
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
  building_code: string;
  building_name: string;
  building_address: string | null;
  unit_id: number;
  occupancy_id: number | null;
  dong: string | null;
  unit_no: string;
  tenant_name: string | null;
  status: SettlementStatus;
  move_out_date: string | null;
  move_in_date: string | null;
  mgmt_fee_prorated: number | null;
  water_charge: number | null;
  elec_charge: number | null;
  gas_charge: number | null;
  meter_no: string | null;
  customer_no: string | null;
  elec_previous_reading: number | null;
  elec_current_reading: number | null;
  elec_usage: number | null;
  gas_previous_reading: number | null;
  gas_current_reading: number | null;
  gas_usage: number | null;
  water_previous_reading: number | null;
  water_current_reading: number | null;
  water_usage: number | null;
  elec_paid_date: string | null;
  gas_paid_date: string | null;
  water_paid_date: string | null;
  repair_amount: number | null;
  cleaning_cost: number | null;
  checked_by_name: string | null;
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
    // 0167 이전 응답에는 settlement_settings 가 없다 → 전부 off / auto 로 본다.
    settlementSettings: {
      waterUnitReflect: r.settlement_settings?.water_unit_reflect ?? false,
      electricUnitReflect: r.settlement_settings?.electric_unit_reflect ?? false,
      vacancyPaymentMode: r.settlement_settings?.vacancy_payment_mode ?? "auto",
    },
    // bigint 합계는 드라이버가 문자열로 줄 수 있다.
    billingUnpaid: Number(r.billing_unpaid ?? 0),
    checklist: r.checklist.map((item) => ({
      id: item.id,
      label: item.label,
      checked: item.checked,
      note: item.note ?? null,
    })),
    meterSummary: r.meter_summary.map((meter) => ({
      utility: meter.utility,
      previousReading: meter.previous_reading,
      currentReading: meter.current_reading,
      unitPrice: meter.unit_price ?? null,
      discountAmount: meter.discount_amount ?? null,
      charge: meter.charge ?? null,
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
    buildingCode: r.building_code,
    buildingName: r.building_name,
    buildingAddress: r.building_address,
    unitId: r.unit_id,
    occupancyId: r.occupancy_id,
    dong: r.dong,
    unitNo: r.unit_no,
    tenantName: r.tenant_name,
    status: r.status,
    moveOutDate: r.move_out_date,
    moveInDate: r.move_in_date,
    mgmtFeeProrated: r.mgmt_fee_prorated,
    waterCharge: r.water_charge,
    elecCharge: r.elec_charge,
    gasCharge: r.gas_charge,
    meterNo: r.meter_no,
    customerNo: r.customer_no,
    elecPreviousReading: r.elec_previous_reading,
    elecCurrentReading: r.elec_current_reading,
    elecUsage: r.elec_usage,
    gasPreviousReading: r.gas_previous_reading,
    gasCurrentReading: r.gas_current_reading,
    gasUsage: r.gas_usage,
    waterPreviousReading: r.water_previous_reading,
    waterCurrentReading: r.water_current_reading,
    waterUsage: r.water_usage,
    elecPaidDate: r.elec_paid_date,
    gasPaidDate: r.gas_paid_date,
    waterPaidDate: r.water_paid_date,
    repairAmount: r.repair_amount,
    cleaningCost: r.cleaning_cost,
    checkedByName: r.checked_by_name,
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

export async function getSettlementContext(
  unitId: number,
  settlementId: number | null = null,
): Promise<SettlementContext> {
  const { data, error } = await createClient().rpc("get_settlement_context", {
    p_unit_id: unitId,
    p_settlement_id: settlementId,
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
      note: item.note,
    })),
  });
  if (error) throw new Error(error.message);
  const result = data as { settlement_id: number; settlement_amount: number };
  return {
    settlementId: result.settlement_id,
    settlementAmount: result.settlement_amount,
  };
}

export async function savePartnerMovingSettlement(
  input: SavePartnerSettlementInput,
): Promise<{ settlementId: number; settlementAmount: number }> {
  const { data, error } = await createClient().rpc(
    "partner_save_moving_settlement",
    {
      p_unit_id: input.unitId,
      p_occupancy_id: input.occupancyId,
      p_settlement_id: input.settlementId,
      p_data: input.data,
      p_checklist: input.checklist,
    },
  );
  if (error) throw new Error(error.message);
  const result = data as { settlement_id: number; settlement_amount: number };
  return {
    settlementId: result.settlement_id,
    settlementAmount: result.settlement_amount,
  };
}

export async function deletePartnerMovingSettlement(
  settlementId: number,
): Promise<void> {
  const { error } = await createClient().rpc(
    "partner_delete_moving_settlement",
    { p_settlement_id: settlementId },
  );
  if (error) throw new Error(error.message);
}

export interface CompleteSettlementResult {
  ok: boolean;
  /** 0167: 공실 수납 방식. manual 이면 자동수납을 생략했다는 뜻이다. */
  vacancy_payment_mode?: "manual" | "auto";
  collected_count?: number;
  collected_total?: number;
}

export async function completeMovingSettlement(
  settlementId: number,
): Promise<CompleteSettlementResult> {
  const { data, error } = await createClient().rpc("complete_moving_settlement", {
    p_settlement_id: settlementId,
  });
  if (error) throw new Error(error.message);
  return data as CompleteSettlementResult;
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
    p_applied_from: params.appliedFrom ?? null,
    p_search: params.search?.trim() || null,
    p_status: params.status ?? null,
    p_sort: params.sort ?? "date",
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

export interface UpdateSettlementInquiryRow {
  settlementId: number;
  elecPaidDate: string | null;
  gasPaidDate: string | null;
  waterPaidDate: string | null;
  cleaningCost: number | null;
}

export async function updateSettlementInquiryRows(
  rows: UpdateSettlementInquiryRow[],
): Promise<{ count: number }> {
  const { data, error } = await createClient().rpc(
    "update_settlement_inquiry_rows",
    {
      p_rows: rows.map((row) => ({
        settlement_id: row.settlementId,
        elec_paid_date: row.elecPaidDate,
        gas_paid_date: row.gasPaidDate,
        water_paid_date: row.waterPaidDate,
        cleaning_cost: row.cleaningCost,
      })),
    },
  );
  if (error) throw new Error(error.message);
  return data as { count: number };
}
