import { createClient } from "@/lib/supabase/client";
import type { OrganizationStatus } from "./apis";

export type OccupancyStatus = "occupied" | "vacant" | "moving_out";

// ── 조직 → 건물 ──
export interface PlatformBuilding {
  id: number;
  code: string;
  name: string;
  address: string | null;
}
export interface OrgBuildingsResult {
  org: { id: number; name: string; slug: string | null; status: OrganizationStatus };
  buildings: PlatformBuilding[];
}

export async function getOrgBuildings(orgId: number): Promise<OrgBuildingsResult> {
  const supabase = createClient();
  const [orgRes, buildingsRes] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, status").eq("id", orgId).single(),
    supabase.from("buildings").select("id, code, name, address").eq("org_id", orgId).is("deleted_at", null).order("name"),
  ]);
  if (orgRes.error) throw new Error(orgRes.error.message);
  if (buildingsRes.error) throw new Error(buildingsRes.error.message);
  const org = orgRes.data as { id: number; name: string; slug: string | null; status: OrganizationStatus };
  const buildings = ((buildingsRes.data ?? []) as Array<{ id: number; code: string; name: string; address: string | null }>)
    .map((b) => ({ id: b.id, code: b.code, name: b.name, address: b.address }));
  return { org, buildings };
}

// ── 건물 → 입주민(세대 + 최신 입주) ──
// ⚠️ 통합관리자(본사)는 입주자 개인정보를 열람하지 않는다(운영 메타데이터만).
//    성명·연락처·납부자·차량 등 PII는 조회/노출하지 않고, 세대 운영 상태(상태·거주인원·입주일)만 다룬다.
export interface PlatformTenantRow {
  unitId: number;
  occupancyId: number | null;
  unitNo: string;
  residentCount: number | null;
  moveInDate: string | null;
  isVacant: boolean;
}
export interface BuildingTenantsResult {
  org: { id: number; name: string };
  building: { id: number; name: string };
  tenants: PlatformTenantRow[];
}
interface UnitRow {
  id: number;
  unit_no: string;
}
interface TenantOccRow {
  id: number;
  unit_id: number;
  resident_count: number | null;
  move_in_date: string | null;
  status: OccupancyStatus;
}

export async function getBuildingTenants(buildingId: number): Promise<BuildingTenantsResult> {
  const supabase = createClient();
  const buildingRes = await supabase.from("buildings").select("id, name, org_id").eq("id", buildingId).single();
  if (buildingRes.error) throw new Error(buildingRes.error.message);
  const building = buildingRes.data as { id: number; name: string; org_id: number };

  const [orgRes, unitsRes] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", building.org_id).single(),
    supabase.from("units").select("id, unit_no").eq("building_id", buildingId).is("deleted_at", null).order("unit_no"),
  ]);
  if (orgRes.error) throw new Error(orgRes.error.message);
  if (unitsRes.error) throw new Error(unitsRes.error.message);

  const units = (unitsRes.data ?? []) as UnitRow[];
  const unitIds = units.map((u) => u.id);
  let occRows: TenantOccRow[] = [];
  if (unitIds.length > 0) {
    const occRes = await supabase
      .from("occupancies")
      .select("id, unit_id, resident_count, move_in_date, status")
      .in("unit_id", unitIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (occRes.error) throw new Error(occRes.error.message);
    occRows = (occRes.data ?? []) as TenantOccRow[];
  }

  const latestByUnit = new Map<number, TenantOccRow>();
  for (const o of occRows) if (!latestByUnit.has(o.unit_id)) latestByUnit.set(o.unit_id, o);

  const tenants: PlatformTenantRow[] = units.map((u) => {
    const o = latestByUnit.get(u.id);
    return {
      unitId: u.id,
      occupancyId: o?.id ?? null,
      unitNo: u.unit_no,
      residentCount: o?.resident_count ?? null,
      moveInDate: o?.move_in_date ?? null,
      isVacant: o ? o.status === "vacant" : true,
    };
  });

  const org = orgRes.data as { id: number; name: string };
  return { org, building: { id: building.id, name: building.name }, tenants };
}

// ── 세대 → 상세(읽기전용) ──
// ⚠️ 통합관리자는 개인정보(성명·연락처·납부자·차량·비고)를 열람하지 않는다. 운영 메타만 반환한다.
export interface PlatformUnitOccupancy {
  occupancyId: number;
  residentCount: number | null;
  roomTypeLabel: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  status: OccupancyStatus;
}
export interface PlatformUnitDetail {
  unitId: number;
  unitNo: string;
  dong: string | null;
  areaPyeong: number | null;
  roomCount: number | null;
  buildingId: number;
  buildingName: string;
  orgId: number;
  orgName: string;
  occupancy: PlatformUnitOccupancy | null;
}
interface UnitFullRow {
  id: number;
  unit_no: string;
  dong: string | null;
  area_pyeong: number | null;
  room_count: number | null;
  building_id: number;
}
interface OccFullRow {
  id: number;
  resident_count: number | null;
  room_type_id: number | null;
  move_in_date: string | null;
  move_out_date: string | null;
  status: OccupancyStatus;
}

export async function getUnitOccupancy(unitId: number): Promise<PlatformUnitDetail> {
  const supabase = createClient();
  const unitRes = await supabase
    .from("units")
    .select("id, unit_no, dong, area_pyeong, room_count, building_id")
    .eq("id", unitId)
    .single();
  if (unitRes.error) throw new Error(unitRes.error.message);
  const unit = unitRes.data as UnitFullRow;

  const [buildingRes, occRes] = await Promise.all([
    supabase.from("buildings").select("id, name, org_id").eq("id", unit.building_id).single(),
    supabase
      .from("occupancies")
      .select("id, resident_count, room_type_id, move_in_date, move_out_date, status")
      .eq("unit_id", unitId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (buildingRes.error) throw new Error(buildingRes.error.message);
  if (occRes.error) throw new Error(occRes.error.message);
  const building = buildingRes.data as { id: number; name: string; org_id: number };

  const orgRes = await supabase.from("organizations").select("name").eq("id", building.org_id).single();
  if (orgRes.error) throw new Error(orgRes.error.message);

  const occ = ((occRes.data ?? []) as OccFullRow[])[0] ?? null;
  let roomTypeLabel: string | null = null;
  if (occ?.room_type_id != null) {
    const rtRes = await supabase.from("room_types").select("label").eq("id", occ.room_type_id).single();
    if (rtRes.error) throw new Error(rtRes.error.message);
    roomTypeLabel = (rtRes.data as { label: string } | null)?.label ?? null;
  }

  return {
    unitId: unit.id,
    unitNo: unit.unit_no,
    dong: unit.dong,
    areaPyeong: unit.area_pyeong,
    roomCount: unit.room_count,
    buildingId: building.id,
    buildingName: building.name,
    orgId: building.org_id,
    orgName: (orgRes.data as { name: string }).name,
    occupancy: occ == null ? null : {
      occupancyId: occ.id,
      residentCount: occ.resident_count,
      roomTypeLabel,
      moveInDate: occ.move_in_date,
      moveOutDate: occ.move_out_date,
      status: occ.status,
    },
  };
}
