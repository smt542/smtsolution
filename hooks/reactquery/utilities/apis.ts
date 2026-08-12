import { createClient } from "@/lib/supabase/client";

export const UTILITY_TYPES = ["water", "electricity", "gas"] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

export interface UtilityUnitRow {
  unitId: number;
  unitNo: string;
  dong: string | null;
  occupancyId: number | null;
  tenantName: string | null;
  occupancyStatus: "occupied" | "vacant" | "moving_out" | null;
  moveInDate: string | null;
  customerNumber: string | null;
  meterNumber: string | null;
  previousReading: number | null;
  currentReading: number | null;
  usage: number | null;
  automaticCharge: number | null;
  manualCharge: number | null;
  note: string | null;
  processedAt: string | null;
}

interface OccupancyRow {
  id: number;
  tenant_name?: string | null;
  status?: UtilityUnitRow["occupancyStatus"];
  move_in_date?: string | null;
  deleted_at?: string | null;
}

interface UnitWithOccupanciesRow {
  id: number;
  unit_no: string;
  dong?: string | null;
  elec_customer_no?: string | null;
  elec_meter_no?: string | null;
  water_customer_no?: string | null;
  occupancies?: OccupancyRow[] | null;
}

function occupancyTime(row: OccupancyRow): number {
  if (!row.move_in_date) return 0;
  const time = Date.parse(row.move_in_date);
  return Number.isNaN(time) ? 0 : time;
}

/**
 * 현재 화면에 표시할 입주 건을 고른다. occupied/moving_out을 우선하고,
 * 같은 상태라면 입주일이 가장 최근인 건을 사용한다.
 */
function currentOccupancy(rows: OccupancyRow[] | null | undefined): OccupancyRow | null {
  const active = (rows ?? []).filter((row) => !row.deleted_at);
  if (active.length === 0) return null;

  return [...active].sort((a, b) => {
    const rank = (status: OccupancyRow["status"]) =>
      status === "occupied" ? 0 : status === "moving_out" ? 1 : 2;
    return rank(a.status) - rank(b.status) || occupancyTime(b) - occupancyTime(a);
  })[0];
}

function customerNumberFor(
  row: UnitWithOccupanciesRow,
  utilityType: UtilityType,
): string | null {
  if (utilityType === "water") return row.water_customer_no ?? null;
  if (utilityType === "electricity") return row.elec_customer_no ?? null;

  // TODO(p3a): building_customer_numbers가 추가되면 가스 및 건물/층별 고객번호를 연결한다.
  return null;
}

function meterNumberFor(
  row: UnitWithOccupanciesRow,
  utilityType: UtilityType,
): string | null {
  if (utilityType === "electricity") return row.elec_meter_no ?? null;

  // TODO(p3a): 수도·가스 계량기 번호용 마스터 데이터가 추가되면 연결한다.
  return null;
}

function rowToUtilityUnit(
  row: UnitWithOccupanciesRow,
  utilityType: UtilityType,
): UtilityUnitRow {
  const occupancy = currentOccupancy(row.occupancies as OccupancyRow[] | null | undefined);

  return {
    unitId: row.id,
    unitNo: row.unit_no,
    dong: row.dong ?? null,
    occupancyId: occupancy?.id ?? null,
    tenantName: occupancy?.tenant_name ?? null,
    occupancyStatus: occupancy?.status ?? null,
    moveInDate: occupancy?.move_in_date ?? null,
    customerNumber: customerNumberFor(row, utilityType),
    meterNumber: meterNumberFor(row, utilityType),

    // TODO(meter): meter_readings가 추가되면 검침값·요금·처리일을 실제 값으로 매핑한다.
    previousReading: null,
    currentReading: null,
    usage: null,
    automaticCharge: null,
    manualCharge: null,
    note: null,
    processedAt: null,
  };
}

/**
 * 현재 스키마에서 가능한 읽기 전용 조회.
 * units와 하위 occupancies를 한 번에 읽고 RLS로 조직 경계를 유지한다.
 */
export async function listUtilityRows(
  buildingId: number,
  utilityType: UtilityType,
): Promise<UtilityUnitRow[]> {
  const { data, error } = await createClient()
    .from("units")
    .select(`
      id,
      building_id,
      unit_no,
      dong,
      elec_customer_no,
      elec_meter_no,
      water_customer_no,
      occupancies (
        id,
        tenant_name,
        status,
        move_in_date,
        deleted_at
      )
    `)
    .eq("building_id", buildingId)
    .is("deleted_at", null)
    .order("unit_no");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    rowToUtilityUnit(row as UnitWithOccupanciesRow, utilityType),
  );
}
