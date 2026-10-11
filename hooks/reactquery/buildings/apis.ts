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

// 건물 등록 재설계(Figma 673:55474) 섹션별 JSONB 페이로드.
// 정규화 테이블에 대응 컬럼이 없는 리치 섹션(적립금·건물주 부가·유틸/업체 보충정보·기본정보 부가)을
// 섹션 단위 JSONB로 왕복 저장한다(마이그 0124). 고객번호와 업체 공통 필드는 정규화 테이블에 저장한다.
export interface BuildingReserveFund { type: string; memo: string }
export interface BuildingOwnerExtra { phoneSub: string; address: string; addressDetail: string; memo: string }
export interface BuildingBasicExtra {
  groupType: string; waterCount: string; contractDate: string;
  terminationDate: string; standingNotice: string; addressDetail: string; buildingTypeLabel: string;
}
export interface BuildingUtilityEntry { cards: Record<string, string>[]; extra: Record<string, string> }
export interface BuildingExtraInfo { utilities: Record<string, BuildingUtilityEntry> }
export interface BuildingVendorEntry { fields: Record<string, string>; memo?: string; assigned?: boolean }
export interface BuildingVendorDetails { vendors: Record<string, BuildingVendorEntry> }

export interface Building {
  id: number; orgId: number; code: string; name: string; address: string | null; typeId: number | null;
  ownerName: string | null; ownerPhone: string | null; entrancePassword: string | null;
  managerUserId: string | null; meterUserId: string | null; cleaningUserId: string | null;
  facilities: FacilitiesMap; memo: string | null; billingNote: string | null;
  setupConfirmRequired: boolean;
  reserveFund?: BuildingReserveFund | null; ownerExtra?: BuildingOwnerExtra | null;
  basicExtra?: BuildingBasicExtra | null; extraInfo?: BuildingExtraInfo | null;
  vendorDetails?: BuildingVendorDetails | null;
}
type BuildingRow = {
  id: number; org_id: number; code: string; name: string; address: string | null; type_id: number | null;
  owner_name: string | null; owner_phone: string | null; entrance_password: string | null;
  manager_user_id: string | null; meter_user_id: string | null; cleaning_user_id: string | null;
  facilities: FacilitiesRow; memo: string | null; billing_note: string | null;
  setup_confirm_required: boolean | null;
  reserve_fund?: unknown; owner_extra?: unknown; basic_extra?: unknown;
  extra_info?: unknown; vendor_details?: unknown;
};

const asObj = <T,>(v: unknown): T | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as T) : null;

const rowToBuilding = (r: BuildingRow): Building => ({
  id: r.id, orgId: r.org_id, code: r.code, name: r.name, address: r.address, typeId: r.type_id,
  ownerName: r.owner_name, ownerPhone: r.owner_phone, entrancePassword: r.entrance_password,
  managerUserId: r.manager_user_id, meterUserId: r.meter_user_id, cleaningUserId: r.cleaning_user_id,
  facilities: toFacilities(r.facilities), memo: r.memo, billingNote: r.billing_note ?? null,
  setupConfirmRequired: r.setup_confirm_required ?? false,
  reserveFund: asObj<BuildingReserveFund>(r.reserve_fund),
  ownerExtra: asObj<BuildingOwnerExtra>(r.owner_extra),
  basicExtra: asObj<BuildingBasicExtra>(r.basic_extra),
  extraInfo: asObj<BuildingExtraInfo>(r.extra_info),
  vendorDetails: asObj<BuildingVendorDetails>(r.vendor_details),
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

/** 서버(list_buildings) 정렬 키. 검침일 정렬은 meterKind(수도·전기·가스·공용전기) 항목의 검침일 기준. */
export type BuildingListSort = "created_desc" | "created_asc" | "meter_day_asc" | "meter_day_desc";
export interface BuildingListParams {
  search?: string; managerUserId?: string; meterUserId?: string; cleaningUserId?: string;
  page?: number; pageSize?: number;
  sort?: BuildingListSort;
  meterKind?: "water" | "elec" | "gas" | "common_elec";
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
    p_sort: params.sort ?? "created_desc",
    p_meter_kind: params.meterKind ?? null,
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

/**
 * 건물 코드가 이미 쓰이고 있는지 확인한다. `buildings_org_id_code_key`가 삭제된 건물까지 포함한 (org, code) 유니크라
 * soft delete된 건물도 센다. RLS가 조직을 걸러 주므로 코드만 비교한다. 수정 모드는 자기 자신(excludeId)을 뺀다.
 */
/** 등록 화면의 건물 코드 기본값(0308 next_building_code: 3자리 최댓값 + 1, 999 다음은 비어 있는 가장 작은 3자리). */
export async function getNextBuildingCode(): Promise<string> {
  const { data, error } = await createClient().rpc("next_building_code");
  if (error) throw new Error(error.message);
  return String(data ?? "");
}

/**
 * 건물 코드 형식: 숫자 3자리. 지로수납처리가 은행 지로 고객조회번호 7~9번째 3자리를 건물 코드로 보고 세대를 찾기 때문이다
 * (lib/payments/giroFile.ts). 서버 save_building(0200)도 같은 검사를 한다.
 */
export const BUILDING_CODE_PATTERN = /^\d{3}$/;

export async function isBuildingCodeTaken(code: string, excludeId?: number): Promise<boolean> {
  let query = createClient().from("buildings").select("id").eq("code", code).limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
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
  // 재설계 폼(마이그 0122)에서 추가로 저장하는 필드. 레거시 폼은 미지정(null 저장).
  typeId?: number | null; entrancePassword?: string | null;
  ownerName?: string | null; ownerPhone?: string | null; billingNote?: string | null;
  reserveFund?: BuildingReserveFund | null; ownerExtra?: BuildingOwnerExtra | null;
  basicExtra?: BuildingBasicExtra | null; extraInfo?: BuildingExtraInfo | null;
  vendorDetails?: BuildingVendorDetails | null;
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
    p_type_id: p.typeId ?? null,
    p_entrance_password: p.entrancePassword ?? null,
    p_owner_name: p.ownerName ?? null,
    p_owner_phone: p.ownerPhone ?? null,
    p_billing_note: p.billingNote ?? null,
    p_reserve_fund: p.reserveFund ?? null,
    p_owner_extra: p.ownerExtra ?? null,
    p_basic_extra: p.basicExtra ?? null,
    p_extra_info: p.extraInfo ?? null,
    p_vendor_details: p.vendorDetails ?? null,
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

/** 건물 삭제 전 점검: 확정 부과·수납 이력 건수(삭제를 막지는 않고 경고에만 쓴다). */
export interface DeleteImpact { confirmationCount: number; paymentCount: number }

export async function getBuildingDeleteImpact(id: number): Promise<DeleteImpact> {
  const { data, error } = await createClient().rpc("building_delete_impact", { p_id: id });
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as { confirmationCount?: number; paymentCount?: number };
  return { confirmationCount: Number(row.confirmationCount ?? 0), paymentCount: Number(row.paymentCount ?? 0) };
}
