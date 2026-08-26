import { createClient } from "@/lib/supabase/client";

const KOREA_TIME_ZONE = "Asia/Seoul";

export interface TodayMoveIn {
  occupancyId: number;
  buildingId: number;
  buildingName: string;
  unitId: number;
  unitNo: string;
  dong?: string | null;
  tenantName?: string | null;
  moveInDate: string;
}

export interface DashboardOverview {
  today: string;
  todayMoveIns: TodayMoveIn[];
  pendingComplaintCount: number;
  overdueHouseholdCount: number;
}

interface BuildingRelation {
  id: number;
  name: string;
}

interface UnitRelation {
  id: number;
  building_id: number;
  unit_no: string;
  dong?: string | null;
  buildings: BuildingRelation | BuildingRelation[] | null;
}

interface MoveInRow {
  id: number;
  tenant_name?: string | null;
  move_in_date: string;
  units: UnitRelation | UnitRelation[] | null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function getKoreaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function countOverdueHouseholds(today: string): Promise<number> {
  const [year, month] = today.split("-").map(Number);
  const { data, error } = await createClient().rpc("count_overdue_households", {
    p_target_year: year,
    p_target_month: month,
  });

  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function getDashboardOverview(
  today = getKoreaToday(),
): Promise<DashboardOverview> {
  const client = createClient();
  const moveInsRequest = client
    .from("occupancies")
    .select(`
      id,
      tenant_name,
      move_in_date,
      units!inner (
        id,
        building_id,
        unit_no,
        dong,
        buildings!inner (
          id,
          name
        )
      )
    `)
    .eq("move_in_date", today)
    .eq("status", "occupied")
    .is("deleted_at", null)
    .is("units.deleted_at", null)
    .is("units.buildings.deleted_at", null)
    .order("unit_id");
  const pendingComplaintsRequest = client
    .from("complaints")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .is("deleted_at", null);

  const [moveInsResponse, pendingComplaintsResponse, overdueHouseholdCount] =
    await Promise.all([
      moveInsRequest,
      pendingComplaintsRequest,
      countOverdueHouseholds(today),
    ]);

  if (moveInsResponse.error) throw new Error(moveInsResponse.error.message);
  if (pendingComplaintsResponse.error) {
    throw new Error(pendingComplaintsResponse.error.message);
  }

  const todayMoveIns = ((moveInsResponse.data ?? []) as unknown as MoveInRow[])
    .map((row): TodayMoveIn | null => {
      const unit = firstRelation(row.units);
      const building = unit ? firstRelation(unit.buildings) : null;
      if (!unit || !building) return null;
      return {
        occupancyId: row.id,
        buildingId: building.id,
        buildingName: building.name,
        unitId: unit.id,
        unitNo: unit.unit_no,
        dong: unit.dong,
        tenantName: row.tenant_name,
        moveInDate: row.move_in_date,
      };
    })
    .filter((row): row is TodayMoveIn => row !== null)
    .sort((a, b) =>
      `${a.buildingName}:${a.dong ?? ""}:${a.unitNo}`.localeCompare(
        `${b.buildingName}:${b.dong ?? ""}:${b.unitNo}`,
        "ko-KR",
      ),
    );

  return {
    today,
    todayMoveIns,
    pendingComplaintCount: pendingComplaintsResponse.count ?? 0,
    overdueHouseholdCount,
  };
}
