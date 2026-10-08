import { createClient } from "@/lib/supabase/client";
import { listMetersByUnit, type UnitMeter } from "@/hooks/reactquery/unitMeters";
import { listAccountsByUnit, type UnitAccount } from "@/hooks/reactquery/unitAccounts";
import { getLeaseByOccupancy, type LeaseContract } from "@/hooks/reactquery/leaseContracts";
import { listHistoryByUnit, type OccupancyHistory } from "@/hooks/reactquery/occupancyHistory";
import { rowToUnit, type Unit, type UnitUsageType } from "@/hooks/reactquery/units";

export type OccupancyStatus = "occupied" | "vacant" | "moving_out";
export type TransferMethod = "giro" | "transfer" | "auto_transfer" | "deposit" | "none";
export type BillNameDisplay = "none" | "name" | "code";
export type BillDelivery = "post" | "alimtalk";
export interface Occupancy {
  id: number; unitId: number; tenantName: string | null; payerName: string | null;
  phone: string | null; phone2: string | null; phone3: string | null; faxNumber: string | null; vehicleNo: string | null;
  residentCount: number | null; roomTypeId: number | null; moveInDate: string | null; moveOutDate: string | null;
  status: OccupancyStatus; billingEnabled: boolean; printEnabled: boolean; lateFeeEnabled: boolean;
  singlePrint: boolean; billingNote: string | null; settlementNote: string | null; facilityNote: string | null;
  transferMethod: TransferMethod; billNameDisplay: BillNameDisplay; billDelivery: BillDelivery; billAuth: boolean;
  moveOutScheduledDate: string | null;
  smsOptIn: boolean; alimtalkOptIn: boolean;
  // 0117 신규
  expectedMoveInDate: string | null; discountType: string | null; discountAmount: number | null;
  homepagePassword: string | null; mgmtFeeAmount: number | null; moveCleaningFee: number | null;
  increaseAmount: number | null; billingDay: string | null; etcNote: string | null; billAuthInfo: string | null;
  phonesExtra: string[]; vehiclesExtra: string[];
  cmsMemberNo: string | null; cmsContractNo: string | null;
}
type OccupancyRow = {
  id: number; unit_id: number; tenant_name: string | null; payer_name: string | null;
  phone: string | null; phone2: string | null; phone3: string | null; fax_number: string | null; vehicle_no: string | null;
  resident_count: number | null; room_type_id: number | null; move_in_date: string | null; move_out_date: string | null;
  status: OccupancyStatus; billing_enabled: boolean; print_enabled: boolean; late_fee_enabled: boolean;
  single_print: boolean; billing_note: string | null; settlement_note: string | null; facility_note: string | null;
  transfer_method: TransferMethod; bill_name_display: BillNameDisplay; bill_delivery: BillDelivery; bill_auth: boolean;
  move_out_scheduled_date: string | null;
  sms_opt_in: boolean; alimtalk_opt_in: boolean;
  expected_move_in_date?: string | null; discount_type?: string | null; discount_amount?: number | null;
  homepage_password?: string | null; mgmt_fee_amount?: number | null; move_cleaning_fee?: number | null;
  increase_amount?: number | null; billing_day?: string | null; etc_note?: string | null; bill_auth_info?: string | null;
  phones_extra?: string[] | null; vehicles_extra?: string[] | null;
  cms_member_no?: string | null; cms_contract_no?: string | null;
};
const rowToOccupancy = (r: OccupancyRow): Occupancy => ({
  id: r.id, unitId: r.unit_id, tenantName: r.tenant_name, payerName: r.payer_name,
  phone: r.phone, phone2: r.phone2, phone3: r.phone3, faxNumber: r.fax_number, vehicleNo: r.vehicle_no,
  residentCount: r.resident_count, roomTypeId: r.room_type_id, moveInDate: r.move_in_date, moveOutDate: r.move_out_date,
  status: r.status, billingEnabled: r.billing_enabled, printEnabled: r.print_enabled, lateFeeEnabled: r.late_fee_enabled,
  singlePrint: r.single_print, billingNote: r.billing_note, settlementNote: r.settlement_note, facilityNote: r.facility_note,
  transferMethod: r.transfer_method, billNameDisplay: r.bill_name_display, billDelivery: r.bill_delivery, billAuth: r.bill_auth,
  moveOutScheduledDate: r.move_out_scheduled_date,
  smsOptIn: r.sms_opt_in ?? false, alimtalkOptIn: r.alimtalk_opt_in ?? false,
  expectedMoveInDate: r.expected_move_in_date ?? null, discountType: r.discount_type ?? null, discountAmount: r.discount_amount ?? null,
  homepagePassword: r.homepage_password ?? null, mgmtFeeAmount: r.mgmt_fee_amount ?? null, moveCleaningFee: r.move_cleaning_fee ?? null,
  increaseAmount: r.increase_amount ?? null, billingDay: r.billing_day ?? null, etcNote: r.etc_note ?? null, billAuthInfo: r.bill_auth_info ?? null,
  phonesExtra: r.phones_extra ?? [], vehiclesExtra: r.vehicles_extra ?? [],
  cmsMemberNo: r.cms_member_no ?? null, cmsContractNo: r.cms_contract_no ?? null,
});

export type Facility = { label: string; on: boolean };
// facilities 는 jsonb — 구(문자열 배열)·신(객체 배열) 형식을 모두 수용한다.
function parseFacilities(raw: unknown): Facility[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) =>
    typeof item === "string"
      ? { label: item, on: true }
      : { label: String((item as { label?: unknown })?.label ?? ""), on: Boolean((item as { on?: unknown })?.on ?? true) },
  );
}

export interface PropertyListing {
  id: number; unitId: number;
  propertyName: string | null; address: string | null; addressDetail: string | null;
  propertyType: string | null; dealType: string | null; rentType: string | null;
  areaM2: number | null; deposit: number | null; jeonseDeposit: number | null; monthlyRent: number | null;
  mgmtFeeDesc: string | null; availableDate: string | null; location: string | null;
  facilities: Facility[];
}
type PropertyRow = {
  id: number; unit_id: number; property_name: string | null; address: string | null; address_detail: string | null;
  property_type: string | null; deal_type: string | null; rent_type: string | null;
  area_m2: number | null; deposit: number | null; jeonse_deposit: number | null; monthly_rent: number | null;
  mgmt_fee_desc: string | null; available_date: string | null; location: string | null; facilities: unknown;
};
const rowToProperty = (r: PropertyRow): PropertyListing => ({
  id: r.id, unitId: r.unit_id, propertyName: r.property_name, address: r.address, addressDetail: r.address_detail,
  propertyType: r.property_type, dealType: r.deal_type, rentType: r.rent_type,
  areaM2: r.area_m2, deposit: r.deposit, jeonseDeposit: r.jeonse_deposit, monthlyRent: r.monthly_rent,
  mgmtFeeDesc: r.mgmt_fee_desc, availableDate: r.available_date, location: r.location,
  facilities: parseFacilities(r.facilities),
});
export async function getPropertyByUnit(unitId: number): Promise<PropertyListing | null> {
  const { data, error } = await createClient().from("unit_property_listings").select("*").eq("unit_id", unitId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToProperty(data as PropertyRow) : null;
}

export interface TenantListRow {
  unitId: number; occupancyId: number | null; unitNo: string; tenantName: string | null; phone: string | null;
  phonesMore: string[]; vehiclesMore: string[];
  roomTypeLabel: string | null; residentCount: number | null; moveInDate: string | null;
  isVacant: boolean; isOverdue: boolean;
  payerName?: string | null; vehicleNo?: string | null; areaPyeong?: number | null;
  mgmtFeeAmount?: number | null;
  expectedMoveInDate?: string | null; increaseAmount?: number | null; billingDay?: string | null;
  billingEnabled?: boolean | null; printEnabled?: boolean | null; billNameDisplay?: BillNameDisplay | null;
  moveOutDate?: string | null; lateFeeEnabled?: boolean | null; singlePrint?: boolean | null;
  transferMethod?: TransferMethod | null; smsOptIn?: boolean | null; billingNote?: string | null;
  billAuth?: boolean | null; billDelivery?: BillDelivery | null; createdAt?: string | null;
  kepcoCustomerNo?: string | null; kepcoMeterNo?: string | null;
  waterCustomerNo?: string | null; waterMeterNo?: string | null;
  elecCustomerNo?: string | null; elecMeterNo?: string | null;
  commonElecCustomerNo?: string | null; commonElecMeterNo?: string | null;
  gasCustomerNo?: string | null; gasMeterNo?: string | null;
  mgmtAccount?: string | null; waterAccount?: string | null; elecAccount?: string | null; gasAccount?: string | null;
  commonElecNo?: string | null;
}

export interface TenantCardRow {
  unitId: number;
  unitNo: string;
  tenantName: string | null;
  roomTypeLabel: string | null;
  residentCount: number | null;
  moveInDate: string | null;
  phone: string | null;
  isVacant: boolean;
  isOverdue: boolean;
}
type TenantRow = {
  unit_id: number; occupancy_id: number | null; unit_no: string; tenant_name: string | null; phone: string | null;
  phones_more?: string[] | null; vehicles_more?: string[] | null;
  room_type_label: string | null; resident_count: number | null; move_in_date: string | null;
  is_vacant: boolean; is_overdue: boolean;
  payer_name?: string | null; vehicle_no?: string | null; area_pyeong?: number | null;
  mgmt_fee_amount?: number | null;
  expected_move_in_date?: string | null; increase_amount?: number | null; billing_day?: string | null;
  billing_enabled?: boolean | null; print_enabled?: boolean | null; bill_name_display?: BillNameDisplay | null;
  move_out_date?: string | null; late_fee_enabled?: boolean | null; single_print?: boolean | null;
  transfer_method?: TransferMethod | null; sms_opt_in?: boolean | null; billing_note?: string | null;
  bill_auth?: boolean | null; bill_delivery?: BillDelivery | null; occupancy_created_at?: string | null;
  kepco_customer_no?: string | null; kepco_meter_no?: string | null;
  water_customer_no?: string | null; water_meter_no?: string | null;
  elec_customer_no?: string | null; elec_meter_no?: string | null;
  common_elec_customer_no?: string | null; common_elec_meter_no?: string | null;
  gas_customer_no?: string | null; gas_meter_no?: string | null;
  mgmt_account?: string | null; water_account?: string | null; elec_account?: string | null; gas_account?: string | null;
  common_elec_no?: string | null;
};
const rowToTenant = (r: TenantRow): TenantListRow => ({
  unitId: r.unit_id, occupancyId: r.occupancy_id, unitNo: r.unit_no, tenantName: r.tenant_name, phone: r.phone,
  phonesMore: r.phones_more ?? [], vehiclesMore: r.vehicles_more ?? [],
  roomTypeLabel: r.room_type_label, residentCount: r.resident_count, moveInDate: r.move_in_date,
  isVacant: r.is_vacant, isOverdue: r.is_overdue,
  payerName: r.payer_name ?? null, vehicleNo: r.vehicle_no ?? null, areaPyeong: r.area_pyeong ?? null,
  mgmtFeeAmount: r.mgmt_fee_amount ?? null,
  expectedMoveInDate: r.expected_move_in_date ?? null, increaseAmount: r.increase_amount ?? null,
  billingDay: r.billing_day ?? null,
  billingEnabled: r.billing_enabled ?? null, printEnabled: r.print_enabled ?? null,
  billNameDisplay: r.bill_name_display ?? null, moveOutDate: r.move_out_date ?? null,
  lateFeeEnabled: r.late_fee_enabled ?? null, singlePrint: r.single_print ?? null,
  transferMethod: r.transfer_method ?? null, smsOptIn: r.sms_opt_in ?? null,
  billingNote: r.billing_note ?? null, billAuth: r.bill_auth ?? null,
  billDelivery: r.bill_delivery ?? null, createdAt: r.occupancy_created_at ?? null,
  kepcoCustomerNo: r.kepco_customer_no ?? null, kepcoMeterNo: r.kepco_meter_no ?? null,
  waterCustomerNo: r.water_customer_no ?? null, waterMeterNo: r.water_meter_no ?? null,
  elecCustomerNo: r.elec_customer_no ?? null, elecMeterNo: r.elec_meter_no ?? null,
  commonElecCustomerNo: r.common_elec_customer_no ?? null, commonElecMeterNo: r.common_elec_meter_no ?? null,
  gasCustomerNo: r.gas_customer_no ?? null, gasMeterNo: r.gas_meter_no ?? null,
  mgmtAccount: r.mgmt_account ?? null, waterAccount: r.water_account ?? null,
  elecAccount: r.elec_account ?? null, gasAccount: r.gas_account ?? null,
  commonElecNo: r.common_elec_no ?? null,
});

export interface UnitOccupancyFull {
  unit: Unit; occupancy: Occupancy | null;
  meters: UnitMeter[]; accounts: UnitAccount[]; lease: LeaseContract | null; history: OccupancyHistory[];
  property: PropertyListing | null;
}
export interface SaveUnitOccupancyPayload {
  buildingId: number; unitId?: number | null; occupancyId?: number | null;
  unit: {
    unitNo: string; dong?: string | null; areaPyeong?: number | null; roomCount?: number | null;
    floor: number | null; usageType: UnitUsageType;
  };
  occupancy: {
    tenantName: string | null; payerName: string | null; phone: string | null; phone2?: string | null; phone3?: string | null; faxNumber?: string | null;
    vehicleNo?: string | null; residentCount?: number | null; roomTypeId: number | null; moveInDate: string | null;
    moveOutDate?: string | null; status: OccupancyStatus; billingEnabled: boolean; printEnabled: boolean;
    lateFeeEnabled: boolean; singlePrint: boolean; billingNote?: string | null; settlementNote?: string | null; facilityNote?: string | null;
    transferMethod: TransferMethod; billNameDisplay: BillNameDisplay; billDelivery: BillDelivery; billAuth: boolean;
    moveOutScheduledDate?: string | null;
    smsOptIn?: boolean; alimtalkOptIn?: boolean;
    expectedMoveInDate?: string | null; discountType?: string | null; discountAmount?: number | null;
    homepagePassword?: string | null; mgmtFeeAmount?: number | null; moveCleaningFee?: number | null;
    increaseAmount?: number | null; billingDay?: string | null; etcNote?: string | null; billAuthInfo?: string | null;
    phonesExtra?: string[]; vehiclesExtra?: string[];
    cmsMemberNo?: string | null; cmsContractNo?: string | null;
  };
  meters: { utility: string; meterNo?: string | null; customerNo?: string | null }[];
  accounts: { kind: string; bank?: string | null; account?: string | null; holder?: string | null; cmsMemberNo?: string | null; payerNo?: string | null }[];
  lease: {
    deposit?: number | null; monthlyRent?: number | null; startDate?: string | null; endDate?: string | null; expiryAlert: boolean;
    leaseType?: string | null; depositDate?: string | null; jeonseDeposit?: number | null; bankAccount?: string | null;
  } | null;
  property?: {
    propertyName?: string | null; address?: string | null; addressDetail?: string | null;
    propertyType?: string | null; dealType?: string | null; rentType?: string | null;
    areaM2?: number | null; deposit?: number | null; jeonseDeposit?: number | null; monthlyRent?: number | null;
    mgmtFeeDesc?: string | null; availableDate?: string | null; location?: string | null; facilities: Facility[];
  } | null;
}
export interface SaveUnitOccupancyResult { unitId: number; occupancyId: number; }

export async function executeDueMoveOuts(): Promise<number> {
  const { data, error } = await createClient().rpc("execute_due_move_outs");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function listTenants(buildingId: number): Promise<TenantListRow[]> {
  try {
    await executeDueMoveOuts();
  } catch (error) {
    // The maintenance RPC is ancillary to this read. Older deployed schemas can
    // omit its authenticated grant, but the tenant directory should still load.
    if (!(error instanceof Error) || !/permission denied for function execute_due_move_outs/i.test(error.message)) {
      throw error;
    }
  }
  const { data, error } = await createClient().rpc("list_tenants", { p_building_id: buildingId });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToTenant);
}

export async function getTenantCardPrintData(buildingId: number): Promise<TenantCardRow[]> {
  const response = await fetch(`/api/buildings/${buildingId}/tenant-cards/print`, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "입주자 카드 데이터를 불러오지 못했습니다.");
  }
  return data as TenantCardRow[];
}

export async function getUnitOccupancyFull(unitId: number): Promise<UnitOccupancyFull> {
  await executeDueMoveOuts();
  const sb = createClient();
  const { data: u, error: ue } = await sb.from("units").select("*").eq("id", unitId).is("deleted_at", null).single();
  if (ue) throw new Error(ue.message);
  const { data: o, error: oe } = await sb.from("occupancies").select("*").eq("unit_id", unitId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (oe) throw new Error(oe.message);
  const occupancy = o ? rowToOccupancy(o) : null;
  const [meters, accounts, history, lease, property] = await Promise.all([
    listMetersByUnit(unitId), listAccountsByUnit(unitId), listHistoryByUnit(unitId),
    occupancy ? getLeaseByOccupancy(occupancy.id) : Promise.resolve(null),
    getPropertyByUnit(unitId),
  ]);
  return { unit: rowToUnit(u), occupancy, meters, accounts, lease, history, property };
}

export async function listOccupancies(unitId: number): Promise<Occupancy[]> {
  const { data, error } = await createClient().from("occupancies").select("*").eq("unit_id", unitId).is("deleted_at", null).order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOccupancy);
}

export async function saveUnitOccupancy(p: SaveUnitOccupancyPayload): Promise<SaveUnitOccupancyResult> {
  const { data, error } = await createClient().rpc("save_unit_occupancy_full", {
    p_building_id: p.buildingId,
    p_unit_id: p.unitId ?? null,
    p_occupancy_id: p.occupancyId ?? null,
    p_unit: {
      unit_no: p.unit.unitNo, dong: p.unit.dong ?? null, area_pyeong: p.unit.areaPyeong ?? null,
      room_count: p.unit.roomCount ?? null, floor: p.unit.floor, usage_type: p.unit.usageType,
    },
    p_occupancy: {
      tenant_name: p.occupancy.tenantName ?? null, payer_name: p.occupancy.payerName ?? null, phone: p.occupancy.phone ?? null,
      phone2: p.occupancy.phone2 ?? null, phone3: p.occupancy.phone3 ?? null, vehicle_no: p.occupancy.vehicleNo ?? null,
      resident_count: p.occupancy.residentCount ?? null, room_type_id: p.occupancy.roomTypeId ?? null,
      move_in_date: p.occupancy.moveInDate ?? null, move_out_date: p.occupancy.moveOutDate ?? null, status: p.occupancy.status,
      billing_enabled: p.occupancy.billingEnabled, print_enabled: p.occupancy.printEnabled,
      late_fee_enabled: p.occupancy.lateFeeEnabled, single_print: p.occupancy.singlePrint,
      billing_note: p.occupancy.billingNote ?? null, settlement_note: p.occupancy.settlementNote ?? null, facility_note: p.occupancy.facilityNote ?? null,
      transfer_method: p.occupancy.transferMethod, bill_name_display: p.occupancy.billNameDisplay,
      bill_delivery: p.occupancy.billDelivery, bill_auth: p.occupancy.billAuth,
      move_out_scheduled_date: p.occupancy.moveOutScheduledDate ?? null,
      // 입력한 값만 보낸다. 값이 없으면 키가 빠져 서버가 기존 값(신규는 기본값=동의)을 유지한다.
      sms_opt_in: p.occupancy.smsOptIn, alimtalk_opt_in: p.occupancy.alimtalkOptIn,
      expected_move_in_date: p.occupancy.expectedMoveInDate ?? null,
      discount_type: p.occupancy.discountType ?? null, discount_amount: p.occupancy.discountAmount ?? null,
      homepage_password: p.occupancy.homepagePassword ?? null,
      mgmt_fee_amount: p.occupancy.mgmtFeeAmount ?? null, move_cleaning_fee: p.occupancy.moveCleaningFee ?? null,
      increase_amount: p.occupancy.increaseAmount ?? null, billing_day: p.occupancy.billingDay ?? null,
      etc_note: p.occupancy.etcNote ?? null, bill_auth_info: p.occupancy.billAuthInfo ?? null,
      phones_extra: p.occupancy.phonesExtra ?? [], vehicles_extra: p.occupancy.vehiclesExtra ?? [],
      cms_member_no: p.occupancy.cmsMemberNo ?? null, cms_contract_no: p.occupancy.cmsContractNo ?? null,
    },
    p_meters: p.meters.map((m) => ({ utility: m.utility, meter_no: m.meterNo ?? null, customer_no: m.customerNo ?? null })),
    p_accounts: p.accounts.map((a) => ({ kind: a.kind, bank: a.bank ?? null, account: a.account ?? null, holder: a.holder ?? null, cms_member_no: a.cmsMemberNo ?? null, payer_no: a.payerNo ?? null })),
    p_lease: p.lease ? {
      deposit: p.lease.deposit ?? null, monthly_rent: p.lease.monthlyRent ?? null,
      start_date: p.lease.startDate ?? null, end_date: p.lease.endDate ?? null, expiry_alert: p.lease.expiryAlert,
      lease_type: p.lease.leaseType ?? null, deposit_date: p.lease.depositDate ?? null,
      jeonse_deposit: p.lease.jeonseDeposit ?? null, bank_account: p.lease.bankAccount ?? null,
    } : null,
    p_fax_number: p.occupancy.faxNumber ?? null,
    p_property: p.property ? {
      property_name: p.property.propertyName ?? null, address: p.property.address ?? null, address_detail: p.property.addressDetail ?? null,
      property_type: p.property.propertyType ?? null, deal_type: p.property.dealType ?? null, rent_type: p.property.rentType ?? null,
      area_m2: p.property.areaM2 ?? null, deposit: p.property.deposit ?? null, jeonse_deposit: p.property.jeonseDeposit ?? null,
      monthly_rent: p.property.monthlyRent ?? null, mgmt_fee_desc: p.property.mgmtFeeDesc ?? null,
      available_date: p.property.availableDate ?? null, location: p.property.location ?? null, facilities: p.property.facilities ?? [],
    } : null,
  });
  if (error) throw new Error(error.message);
  const result = data as { unit_id: number; occupancy_id: number };
  return { unitId: result.unit_id, occupancyId: result.occupancy_id };
}

export async function executeMoveOut(occupancyId: number, moveOutDate: string): Promise<void> {
  const { error } = await createClient().rpc("execute_move_out", {
    p_occupancy_id: occupancyId,
    p_move_out_date: moveOutDate,
  });
  if (error) throw new Error(error.message);
}

export async function scheduleMoveOut(occupancyId: number, moveOutDate: string): Promise<string> {
  const { data, error } = await createClient().rpc("schedule_move_out", {
    p_occupancy_id: occupancyId,
    p_move_out_date: moveOutDate,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function cancelMoveOutSchedule(occupancyId: number): Promise<void> {
  const { error } = await createClient().rpc("cancel_move_out_schedule", { p_occupancy_id: occupancyId });
  if (error) throw new Error(error.message);
}

export async function deleteUnit(unitId: number): Promise<void> {
  const { error } = await createClient().rpc("delete_unit", { p_unit_id: unitId });
  if (error) throw new Error(error.message);
}

/** 연체료 부과 여부가 X(occupancies.late_fee_enabled=false)인 입주 id. 조직 범위는 RLS가 제한한다. */
export async function listLateFeeDisabledOccupancyIds(): Promise<number[]> {
  const { data, error } = await createClient()
    .from("occupancies")
    .select("id")
    .eq("late_fee_enabled", false)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: number }[]).map((row) => row.id);
}
