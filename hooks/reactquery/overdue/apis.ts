import { createClient } from "@/lib/supabase/client";

export interface OverdueBuilding {
  id: number;
  code: string;
  name: string;
  address?: string | null;
}

export type OverdueScope = "all" | "current";

export interface OverdueQueryParams {
  year?: number;
  month?: number;
  scope?: OverdueScope;
}

export interface ResolvedOverdueQuery {
  year: number;
  month: number;
  scope: OverdueScope;
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

interface OverdueAggregateRow {
  occupancy_id: number;
  unit_id: number;
  overdue_amount: number | string;
  overdue_months: number | string;
  last_payment_date: string | null;
  billing_available: boolean;
}

interface OverdueAggregate {
  occupancyId: number;
  unitId: number;
  overdueAmount: number;
  overdueMonths: number;
  lastPaymentDate: string | null;
  billingAvailable: boolean;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function resolveOverdueQuery(
  params: OverdueQueryParams = {},
  now = new Date(),
): ResolvedOverdueQuery {
  const year = Number.isInteger(params.year) && (params.year ?? 0) >= 1 && (params.year ?? 0) <= 9999
    ? params.year as number
    : now.getFullYear();
  const month = Number.isInteger(params.month) && (params.month ?? 0) >= 1 && (params.month ?? 0) <= 12
    ? params.month as number
    : now.getMonth() + 1;
  return {
    year,
    month,
    scope: params.scope === "current" ? "current" : "all",
  };
}

function aggregateKey(occupancyId: number, unitId: number): string {
  return `${occupancyId}:${unitId}`;
}

function rowToAggregate(row: OverdueAggregateRow): OverdueAggregate {
  return {
    occupancyId: row.occupancy_id,
    unitId: row.unit_id,
    overdueAmount: Number(row.overdue_amount),
    overdueMonths: Number(row.overdue_months),
    lastPaymentDate: row.last_payment_date,
    billingAvailable: row.billing_available,
  };
}

function rowToHousehold(
  row: OccupancyRow,
  aggregate?: OverdueAggregate,
): OverdueHousehold | null {
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
    overdueMonths: aggregate?.overdueMonths ?? 0,
    overdueAmount: aggregate?.overdueAmount ?? 0,
    lastPaymentDate: aggregate?.lastPaymentDate ?? null,
    billingAvailable: aggregate?.billingAvailable ?? false,
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

export async function listOverdueHouseholds(
  buildingId: number,
  params: OverdueQueryParams = {},
): Promise<OverdueHousehold[]> {
  const query = resolveOverdueQuery(params);
  const client = createClient();
  const occupanciesRequest = client
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

  const aggregatesRequest = client.rpc("list_overdue_aggregates", {
    p_building_id: buildingId,
    p_target_year: query.year,
    p_target_month: query.month,
    p_scope: query.scope,
  });

  const [occupanciesResponse, aggregatesResponse] = await Promise.all([
    occupanciesRequest,
    aggregatesRequest,
  ]);

  if (occupanciesResponse.error) throw new Error(occupanciesResponse.error.message);
  if (aggregatesResponse.error) throw new Error(aggregatesResponse.error.message);

  const aggregates = new Map(
    ((aggregatesResponse.data ?? []) as OverdueAggregateRow[]).map((row) => {
      const aggregate = rowToAggregate(row);
      return [aggregateKey(aggregate.occupancyId, aggregate.unitId), aggregate] as const;
    }),
  );

  return ((occupanciesResponse.data ?? []) as unknown as OccupancyRow[])
    .map((row) => {
      const unit = firstRelation(row.units);
      const aggregate = unit
        ? aggregates.get(aggregateKey(row.id, unit.id))
        : undefined;
      return rowToHousehold(row, aggregate);
    })
    .filter((row): row is OverdueHousehold => row !== null);
}

