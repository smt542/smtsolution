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
function toFacilities(raw: any): FacilitiesMap {
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
  facilities: FacilitiesMap; memo: string | null;
}
const rowToBuilding = (r: any): Building => ({
  id: r.id, orgId: r.org_id, code: r.code, name: r.name, address: r.address, typeId: r.type_id,
  ownerName: r.owner_name, ownerPhone: r.owner_phone, entrancePassword: r.entrance_password,
  managerUserId: r.manager_user_id, meterUserId: r.meter_user_id, cleaningUserId: r.cleaning_user_id,
  facilities: toFacilities(r.facilities), memo: r.memo,
});

export interface BuildingDirectoryRow {
  id: number; code: string; name: string; address: string | null;
  managerUserId: string | null; meterUserId: string | null; cleaningUserId: string | null;
  managerName: string | null; meterName: string | null; cleaningName: string | null;
  totalUnits: number; occupiedUnits: number; minMeterDay: number | null;
}
const rowToDirectory = (r: any): BuildingDirectoryRow => ({
  id: r.id, code: r.code, name: r.name, address: r.address,
  managerUserId: r.manager_user_id, meterUserId: r.meter_user_id, cleaningUserId: r.cleaning_user_id,
  managerName: r.manager_name, meterName: r.meter_name, cleaningName: r.cleaning_name,
  totalUnits: Number(r.total_units ?? 0), occupiedUnits: Number(r.occupied_units ?? 0),
  minMeterDay: r.min_meter_day,
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
  billingBasis: string; printOnBill: boolean; holderName?: string | null; sortOrder?: number; _deleted?: boolean;
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
      sort_order: c.sortOrder ?? 0, _deleted: c._deleted ?? false,
    })),
    p_vendors: p.vendors.map((v) => ({
      id: v.id, client_key: v.clientKey, vendor_type: v.vendorType, name: v.name,
      phone: v.phone ?? null, memo: v.memo ?? null, sort_order: v.sortOrder ?? 0, _deleted: v._deleted ?? false,
    })),
  });
  if (error) throw new Error(error.message);
  return {
    buildingId: (data as any).building_id,
    vendors: ((data as any).vendors ?? []).map((x: any) => ({ clientKey: x.client_key, id: x.id })),
  };
}

export async function deleteBuilding(id: number): Promise<void> {
  const { error } = await createClient().rpc("soft_delete_building", { p_id: id });
  if (error) throw new Error(error.message);
}
