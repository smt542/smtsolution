import { createClient } from "@/lib/supabase/client";

export interface OverdueBuilding {
  id: number;
  code: string;
  name: string;
  address?: string | null;
}

export interface OverdueHousehold {
  occupancyId: number;
  buildingId: number;
  buildingName: string;
  buildingAddress?: string | null;
  unitId: number;
  unitNo: string;
  dong?: string | null;
  areaPyeong?: number | null;
  roomCount?: number | null;
  tenantName?: string | null;
  payerName?: string | null;
  phone?: string | null;
  residentCount?: number | null;
  vehicleNo?: string | null;
  moveInDate?: string | null;
  moveOutDate?: string | null;
  status: "occupied" | "vacant" | "moving_out";
  memo?: string | null;
  unitMemo?: string | null;
  overdueMonths: number;
  overdueAmount: number;
  lastPaymentDate: string | null;
  billingAvailable: boolean;
}

interface BuildingRow {
  id: number;
  code: string;
  name: string;
  address?: string | null;
}

interface EmbeddedBuildingRow {
  id: number;
  name: string;
  address?: string | null;
}

interface EmbeddedUnitRow {
  id: number;
  building_id: number;
  unit_no: string;
  dong?: string | null;
  area_pyeong?: number | string | null;
  room_count?: number | null;
  memo?: string | null;
  buildings: EmbeddedBuildingRow | EmbeddedBuildingRow[] | null;
}

interface OccupancyRow {
  id: number;
  tenant_name?: string | null;
  payer_name?: string | null;
  phone?: string | null;
  resident_count?: number | null;
  vehicle_no?: string | null;
  move_in_date?: string | null;
  move_out_date?: string | null;
  status: "occupied" | "vacant" | "moving_out";
  memo?: string | null;
  units: EmbeddedUnitRow | EmbeddedUnitRow[] | null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function rowToHousehold(row: OccupancyRow): OverdueHousehold | null {
  const unit = firstRelation(row.units);
  const building = unit ? firstRelation(unit.buildings) : null;
  if (!unit || !building) return null;

  return {
    occupancyId: row.id,
    buildingId: unit.building_id,
    buildingName: building.name,
    buildingAddress: building.address,
    unitId: unit.id,
    unitNo: unit.unit_no,
    dong: unit.dong,
    areaPyeong: unit.area_pyeong != null ? Number(unit.area_pyeong) : null,
    roomCount: unit.room_count,
    tenantName: row.tenant_name,
    payerName: row.payer_name,
    phone: row.phone,
    residentCount: row.resident_count,
    vehicleNo: row.vehicle_no,
    moveInDate: row.move_in_date,
    moveOutDate: row.move_out_date,
    status: row.status,
    memo: row.memo,
    unitMemo: unit.memo,
    // TODO(billing): 청구/수납 스키마가 생기면 연체 집계 결과로 교체한다.
    overdueMonths: 0,
    // TODO(billing): 청구/수납 스키마가 생기면 미납 원장 합계로 교체한다.
    overdueAmount: 0,
    // TODO(billing): payments 연동 후 실제 최근 납부일을 제공한다.
    lastPaymentDate: null,
    billingAvailable: false,
  };
}

export async function listOverdueBuildings(): Promise<OverdueBuilding[]> {
  const { data, error } = await createClient()
    .from("buildings")
    .select("id, code, name, address")
    .is("deleted_at", null)
    .order("code");

  if (error) throw new Error(error.message);
  return ((data ?? []) as BuildingRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    address: row.address,
  }));
}

export async function listOverdueHouseholds(buildingId: number): Promise<OverdueHousehold[]> {
  const { data, error } = await createClient()
    .from("occupancies")
    .select(`
      id,
      tenant_name,
      payer_name,
      phone,
      resident_count,
      vehicle_no,
      move_in_date,
      move_out_date,
      status,
      memo,
      units!inner (
        id,
        building_id,
        unit_no,
        dong,
        area_pyeong,
        room_count,
        memo,
        buildings!inner (
          id,
          name,
          address
        )
      )
    `)
    .eq("units.building_id", buildingId)
    .eq("status", "occupied")
    .is("deleted_at", null)
    .is("units.deleted_at", null)
    .order("id");

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as OccupancyRow[])
    .map(rowToHousehold)
    .filter((row): row is OverdueHousehold => row !== null);
}

