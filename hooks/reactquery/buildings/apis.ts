// hooks/reactquery/buildings/apis.ts
import { createClient } from "@/lib/supabase/client";
import { listCustomerNumbersByBuilding, type BuildingCustomerNumber } from "@/hooks/reactquery/buildingCustomerNumbers";
import { listBuildingVendorsByBuilding, type BuildingVendor } from "@/hooks/reactquery/buildingVendors";

export const FACILITY_KEYS = [
  "cctv", "elevator", "cleaning", "metering", "management",
  "septic", "internet", "electric_safety", "fire_safety",
] as const;
export type FacilityKey = (typeof FACILITY_KEYS)[number];
export interface FacilityFlag { on: boolean; memo: string; }
export type FacilitiesMap = Record<FacilityKey, FacilityFlag>;
export function emptyFacilities(): FacilitiesMap {
  return Object.fromEntries(FACILITY_KEYS.map((k) => [k, { on: false, memo: "" }])) as FacilitiesMap;
}
type FacilitiesRow = Partial<Record<FacilityKey, Partial<FacilityFlag> | null>> | null;

function toFacilities(raw: FacilitiesRow): FacilitiesMap {
  const base = emptyFacilities();
  if (raw && typeof raw === "object") {
    for (const k of FACILITY_KEYS) {
      if (raw[k]) base[k] = { on: !!raw[k].on, memo: typeof raw[k].memo === "string" ? raw[k].memo : "" };
    }
  }
  return base;
}

export interface Building {
  id: number; orgId: number; code: string; name: string; address: string | null; typeId: number | null;
  ownerName: string | null; ownerPhone: string | null; entrancePassword: string | null;
  managerUserId: string | null; meterUserId: string | null; cleaningUserId: string | null;
  facilities: FacilitiesMap; memo: string | null; billingNote: string | null;
  setupConfirmRequired: boolean;
}
type BuildingRow = {
  id: number; org_id: number; code: string; name: string; address: string | null; type_id: number | null;
  owner_name: string | null; owner_phone: string | null; entrance_password: string | null;
  manager_user_id: string | null; meter_user_id: string | null; cleaning_user_id: string | null;
  facilities: FacilitiesRow; memo: string | null; billing_note: string | null;
  setup_confirm_required: boolean | null;
};

const rowToBuilding = (r: BuildingRow): Building => ({
  id: r.id, orgId: r.org_id, code: r.code, name: r.name, address: r.address, typeId: r.type_id,
  ownerName: r.owner_name, ownerPhone: r.owner_phone, entrancePassword: r.entrance_password,
  managerUserId: r.manager_user_id, meterUserId: r.meter_user_id, cleaningUserId: r.cleaning_user_id,
  facilities: toFacilities(r.facilities), memo: r.memo, billingNote: r.billing_note ?? null,
  setupConfirmRequired: r.setup_confirm_required ?? false,
});

export interface BuildingDirectoryRow {
  id: number; code: string; name: string; address: string | null;
  managerUserId: string | null; meterUserId: string | null; cleaningUserId: string | null;
  managerName: string | null; meterName: string | null; cleaningName: string | null;
  totalUnits: number; occupiedUnits: number; minMeterDay: number | null;
  typeLabel: string | null; ownerName: string | null; ownerPhone: string | null;
  commonEntrance: string | null; createdAt: string | null;
}
type BuildingDirectoryDbRow = {
  id: number; code: string; name: string; address: string | null;
  manager_user_id: string | null; meter_user_id: string | null; cleaning_user_id: string | null;
  manager_name: string | null; meter_name: string | null; cleaning_name: string | null;
  total_units: unknown; occupied_units: unknown; min_meter_day: number | null;
  type_label?: string | null; owner_name?: string | null; owner_phone?: string | null;
  entrance_password?: string | null; created_at?: string | null;
};

const rowToDirectory = (r: BuildingDirectoryDbRow): BuildingDirectoryRow => ({
  id: r.id, code: r.code, name: r.name, address: r.address,
  managerUserId: r.manager_user_id, meterUserId: r.meter_user_id, cleaningUserId: r.cleaning_user_id,
  managerName: r.manager_name, meterName: r.meter_name, cleaningName: r.cleaning_name,
  totalUnits: Number(r.total_units ?? 0), occupiedUnits: Number(r.occupied_units ?? 0),
  minMeterDay: r.min_meter_day,
  typeLabel: r.type_label ?? null, ownerName: r.owner_name ?? null, ownerPhone: r.owner_phone ?? null,
  commonEntrance: r.entrance_password ?? null, createdAt: r.created_at ?? null,
});

export interface BuildingListParams {
  search?: string; managerUserId?: string; meterUserId?: string; cleaningUserId?: string;
  page?: number; pageSize?: number;
}
export interface BuildingListResult { rows: BuildingDirectoryRow[]; total: number; }

export async function listBuildings(params: BuildingListParams = {}): Promise<BuildingListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const { data, error } = await createClient().rpc("list_buildings", {
    p_search: params.search ?? null,
    p_manager: params.managerUserId ?? null,
    p_meter: params.meterUserId ?? null,
    p_cleaning: params.cleaningUserId ?? null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(rowToDirectory);
  const total = data && data.length > 0 ? Number(data[0].total) : 0;
  return { rows, total };
}

// 전체 건물 목록(드롭다운용) — org 범위는 RLS로 격리
export async function listAllBuildings(): Promise<Building[]> {
  const { data, error } = await createClient().from("buildings").select("*").is("deleted_at", null).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToBuilding);
}

export interface BuildingFull extends Building {
  customerNumbers: BuildingCustomerNumber[];
  vendors: BuildingVendor[];
}
export async function getBuildingFull(id: number): Promise<BuildingFull> {
  const { data, error } = await createClient()
    .from("buildings").select("*").eq("id", id).is("deleted_at", null).single();
  if (error) throw new Error(error.message);
  const [customerNumbers, vendors] = await Promise.all([
    listCustomerNumbersByBuilding(id),
    listBuildingVendorsByBuilding(id),
  ]);
  return { ...rowToBuilding(data), customerNumbers, vendors };
}

export interface CustomerNumberPayload {
  id?: number; kind: string; customerNo: string; meterDay?: number | null;
  lineName?: string | null; billingBasis: string; calculationMethod?: "auto" | "manual";
  note?: string | null; printOnBill: boolean; holderName?: string | null;
  sortOrder?: number; _deleted?: boolean;
}
export interface VendorPayload {
  id?: number; clientKey?: string; vendorType: string; name: string;
  phone?: string | null; memo?: string | null; sortOrder?: number; _deleted?: boolean;
}
export interface SaveBuildingPayload {
  id?: number | null; code?: string; name: string; address?: string | null;
  managerUserId?: string | null; meterUserId?: string | null; cleaningUserId?: string | null;
  facilities: FacilitiesMap; memo?: string | null;
  customerNumbers: CustomerNumberPayload[]; vendors: VendorPayload[];
}
export interface SaveBuildingResult { buildingId: number; vendors: { clientKey: string; id: number }[]; }
type SaveBuildingVendorRow = { client_key: string; id: number };
type SaveBuildingRow = { building_id: number; vendors?: SaveBuildingVendorRow[] | null };

export async function saveBuilding(p: SaveBuildingPayload): Promise<SaveBuildingResult> {
  const { data, error } = await createClient().rpc("save_building", {
    p_id: p.id ?? null,
    p_code: p.code ?? null,
    p_name: p.name,
    p_address: p.address ?? null,
    p_manager_user_id: p.managerUserId ?? null,
    p_meter_user_id: p.meterUserId ?? null,
    p_cleaning_user_id: p.cleaningUserId ?? null,
    p_facilities: p.facilities,
    p_memo: p.memo ?? null,
    p_customer_numbers: p.customerNumbers.map((c) => ({
      id: c.id, kind: c.kind, customer_no: c.customerNo, meter_day: c.meterDay ?? null,
      billing_basis: c.billingBasis, print_on_bill: c.printOnBill, holder_name: c.holderName ?? null,
      line_name: c.lineName ?? null, calculation_method: c.calculationMethod ?? "auto",
      note: c.note ?? null,
      sort_order: c.sortOrder ?? 0, _deleted: c._deleted ?? false,
    })),
    p_vendors: p.vendors.map((v) => ({
      id: v.id, client_key: v.clientKey, vendor_type: v.vendorType, name: v.name,
      phone: v.phone ?? null, memo: v.memo ?? null, sort_order: v.sortOrder ?? 0, _deleted: v._deleted ?? false,
    })),
  });
  if (error) throw new Error(error.message);
  return {
    buildingId: (data as SaveBuildingRow).building_id,
    vendors: ((data as SaveBuildingRow).vendors ?? []).map((x: SaveBuildingVendorRow) => ({ clientKey: x.client_key, id: x.id })),
  };
}

// §3.4 관리비 셋팅 확인 플래그 토글 (shared save_building 미변경; 0092 전용 RPC)
export async function setBuildingSetupConfirm(id: number, required: boolean): Promise<void> {
  const { error } = await createClient().rpc("set_building_setup_confirm", { p_id: id, p_required: required });
  if (error) throw new Error(error.message);
}

export async function deleteBuilding(id: number): Promise<void> {
  const { error } = await createClient().rpc("soft_delete_building", { p_id: id });
  if (error) throw new Error(error.message);
}
