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
}
type OccupancyRow = {
  id: number; unit_id: number; tenant_name: string | null; payer_name: string | null;
  phone: string | null; phone2: string | null; phone3: string | null; fax_number: string | null; vehicle_no: string | null;
  resident_count: number | null; room_type_id: number | null; move_in_date: string | null; move_out_date: string | null;
  status: OccupancyStatus; billing_enabled: boolean; print_enabled: boolean; late_fee_enabled: boolean;
  single_print: boolean; billing_note: string | null; settlement_note: string | null; facility_note: string | null;
  transfer_method: TransferMethod; bill_name_display: BillNameDisplay; bill_delivery: BillDelivery; bill_auth: boolean;
  move_out_scheduled_date: string | null;
};
const rowToOccupancy = (r: OccupancyRow): Occupancy => ({
  id: r.id, unitId: r.unit_id, tenantName: r.tenant_name, payerName: r.payer_name,
  phone: r.phone, phone2: r.phone2, phone3: r.phone3, faxNumber: r.fax_number, vehicleNo: r.vehicle_no,
  residentCount: r.resident_count, roomTypeId: r.room_type_id, moveInDate: r.move_in_date, moveOutDate: r.move_out_date,
  status: r.status, billingEnabled: r.billing_enabled, printEnabled: r.print_enabled, lateFeeEnabled: r.late_fee_enabled,
  singlePrint: r.single_print, billingNote: r.billing_note, settlementNote: r.settlement_note, facilityNote: r.facility_note,
  transferMethod: r.transfer_method, billNameDisplay: r.bill_name_display, billDelivery: r.bill_delivery, billAuth: r.bill_auth,
  moveOutScheduledDate: r.move_out_scheduled_date,
});

export interface TenantListRow {
  unitId: number; occupancyId: number | null; unitNo: string; tenantName: string | null; phone: string | null;
  roomTypeLabel: string | null; residentCount: number | null; moveInDate: string | null;
  isVacant: boolean; isOverdue: boolean;
}
type TenantRow = {
  unit_id: number; occupancy_id: number | null; unit_no: string; tenant_name: string | null; phone: string | null;
  room_type_label: string | null; resident_count: number | null; move_in_date: string | null;
  is_vacant: boolean; is_overdue: boolean;
};
const rowToTenant = (r: TenantRow): TenantListRow => ({
  unitId: r.unit_id, occupancyId: r.occupancy_id, unitNo: r.unit_no, tenantName: r.tenant_name, phone: r.phone,
  roomTypeLabel: r.room_type_label, residentCount: r.resident_count, moveInDate: r.move_in_date,
  isVacant: r.is_vacant, isOverdue: r.is_overdue,
});

export interface UnitOccupancyFull {
  unit: Unit; occupancy: Occupancy | null;
  meters: UnitMeter[]; accounts: UnitAccount[]; lease: LeaseContract | null; history: OccupancyHistory[];
}
export interface SaveUnitOccupancyPayload {
  buildingId: number; unitId?: number | null; occupancyId?: number | null;
  unit: {
    unitNo: string; dong?: string | null; areaPyeong?: number | null; roomCount?: number | null;
    floor: number | null; usageType: UnitUsageType;
  };
  occupancy: {
    tenantName: string; payerName: string; phone: string; phone2?: string | null; phone3?: string | null; faxNumber?: string | null;
    vehicleNo?: string | null; residentCount?: number | null; roomTypeId: number | null; moveInDate: string;
    moveOutDate?: string | null; status: OccupancyStatus; billingEnabled: boolean; printEnabled: boolean;
    lateFeeEnabled: boolean; singlePrint: boolean; billingNote?: string | null; settlementNote?: string | null; facilityNote?: string | null;
    transferMethod: TransferMethod; billNameDisplay: BillNameDisplay; billDelivery: BillDelivery; billAuth: boolean;
    moveOutScheduledDate?: string | null;
  };
  meters: { utility: string; meterNo?: string | null; customerNo?: string | null }[];
  accounts: { kind: string; bank?: string | null; account?: string | null; holder?: string | null; cmsMemberNo?: string | null; payerNo?: string | null }[];
  lease: { deposit?: number | null; monthlyRent?: number | null; startDate?: string | null; endDate?: string | null; expiryAlert: boolean } | null;
}
export interface SaveUnitOccupancyResult { unitId: number; occupancyId: number; }

export async function executeDueMoveOuts(): Promise<number> {
  const { data, error } = await createClient().rpc("execute_due_move_outs");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function listTenants(buildingId: number): Promise<TenantListRow[]> {
  await executeDueMoveOuts();
  const { data, error } = await createClient().rpc("list_tenants", { p_building_id: buildingId });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToTenant);
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
  const [meters, accounts, history, lease] = await Promise.all([
    listMetersByUnit(unitId), listAccountsByUnit(unitId), listHistoryByUnit(unitId),
    occupancy ? getLeaseByOccupancy(occupancy.id) : Promise.resolve(null),
  ]);
  return { unit: rowToUnit(u), occupancy, meters, accounts, lease, history };
}

export async function listOccupancies(unitId: number): Promise<Occupancy[]> {
  const { data, error } = await createClient().from("occupancies").select("*").eq("unit_id", unitId).is("deleted_at", null).order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOccupancy);
}

export async function saveUnitOccupancy(p: SaveUnitOccupancyPayload): Promise<SaveUnitOccupancyResult> {
  const { data, error } = await createClient().rpc("save_unit_occupancy_with_fax", {
    p_building_id: p.buildingId,
    p_unit_id: p.unitId ?? null,
    p_occupancy_id: p.occupancyId ?? null,
    p_unit: {
      unit_no: p.unit.unitNo, dong: p.unit.dong ?? null, area_pyeong: p.unit.areaPyeong ?? null,
      room_count: p.unit.roomCount ?? null, floor: p.unit.floor, usage_type: p.unit.usageType,
    },
    p_occupancy: {
      tenant_name: p.occupancy.tenantName, payer_name: p.occupancy.payerName, phone: p.occupancy.phone,
      phone2: p.occupancy.phone2 ?? null, phone3: p.occupancy.phone3 ?? null, vehicle_no: p.occupancy.vehicleNo ?? null,
      resident_count: p.occupancy.residentCount ?? null, room_type_id: p.occupancy.roomTypeId,
      move_in_date: p.occupancy.moveInDate, move_out_date: p.occupancy.moveOutDate ?? null, status: p.occupancy.status,
      billing_enabled: p.occupancy.billingEnabled, print_enabled: p.occupancy.printEnabled,
      late_fee_enabled: p.occupancy.lateFeeEnabled, single_print: p.occupancy.singlePrint,
      billing_note: p.occupancy.billingNote ?? null, settlement_note: p.occupancy.settlementNote ?? null, facility_note: p.occupancy.facilityNote ?? null,
      transfer_method: p.occupancy.transferMethod, bill_name_display: p.occupancy.billNameDisplay,
      bill_delivery: p.occupancy.billDelivery, bill_auth: p.occupancy.billAuth,
      move_out_scheduled_date: p.occupancy.moveOutScheduledDate ?? null,
    },
    p_meters: p.meters.map((m) => ({ utility: m.utility, meter_no: m.meterNo ?? null, customer_no: m.customerNo ?? null })),
    p_accounts: p.accounts.map((a) => ({ kind: a.kind, bank: a.bank ?? null, account: a.account ?? null, holder: a.holder ?? null, cms_member_no: a.cmsMemberNo ?? null, payer_no: a.payerNo ?? null })),
    p_lease: p.lease ? { deposit: p.lease.deposit ?? null, monthly_rent: p.lease.monthlyRent ?? null, start_date: p.lease.startDate ?? null, end_date: p.lease.endDate ?? null, expiry_alert: p.lease.expiryAlert } : null,
    p_fax_number: p.occupancy.faxNumber ?? null,
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
