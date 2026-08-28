import { createClient } from "@/lib/supabase/client";
import { fetchTodayMoveIns, type TodayMoveIn } from "../dashboard/apis";

export type { TodayMoveIn };

/** 임대 만료 임박 세대 1건 (수납관리 진입 알림용) */
export interface UpcomingLeaseExpiry {
  leaseId: number;
  occupancyId: number;
  buildingId: number;
  buildingName: string;
  unitId: number;
  unitNo: string;
  dong?: string | null;
  tenantName?: string | null;
  endDate: string;
  /** 오늘로부터 만료일까지 남은 일수 (D-N) */
  daysLeft: number;
}

interface BuildingRelation {
  id: number;
  name: string;
  deleted_at?: string | null;
}

interface UnitRelation {
  id: number;
  building_id: number;
  unit_no: string;
  dong?: string | null;
  deleted_at?: string | null;
  buildings: BuildingRelation | BuildingRelation[] | null;
}

interface OccupancyRelation {
  id: number;
  tenant_name?: string | null;
  status: string;
  deleted_at?: string | null;
  units: UnitRelation | UnitRelation[] | null;
}

interface LeaseExpiryRow {
  id: number;
  end_date: string;
  occupancies: OccupancyRelation | OccupancyRelation[] | null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** "YYYY-MM-DD"에 일수를 더한 "YYYY-MM-DD" (UTC 고정으로 DST/타임존 영향 없음) */
function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 두 "YYYY-MM-DD" 사이의 일수 차 (to - from) */
function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** 당일 입주예정 세대 (대시보드 요약과 동일 쿼리 재사용) */
export function getTodayMoveIns(today: string): Promise<TodayMoveIn[]> {
  return fetchTodayMoveIns(createClient(), today);
}

/**
 * 만료일이 [today, today+withinDays] 구간인 임대 계약 세대 목록.
 * lease_contracts RLS(lc_select: buildings.org_id in my_org_ids())로 org 격리되므로 직접 조회한다.
 */
export async function getUpcomingLeaseExpiries(
  today: string,
  withinDays = 30,
): Promise<UpcomingLeaseExpiry[]> {
  const maxDate = addDaysISO(today, withinDays);
  const { data, error } = await createClient()
    .from("lease_contracts")
    .select(`
      id,
      end_date,
      occupancies!inner (
        id,
        tenant_name,
        status,
        deleted_at,
        units!inner (
          id,
          building_id,
          unit_no,
          dong,
          deleted_at,
          buildings!inner (
            id,
            name,
            deleted_at
          )
        )
      )
    `)
    .gte("end_date", today)
    .lte("end_date", maxDate)
    .eq("occupancies.status", "occupied")
    .is("occupancies.deleted_at", null)
    .is("occupancies.units.deleted_at", null)
    .is("occupancies.units.buildings.deleted_at", null)
    .order("end_date");

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as LeaseExpiryRow[])
    .map((row): UpcomingLeaseExpiry | null => {
      const occupancy = firstRelation(row.occupancies);
      const unit = occupancy ? firstRelation(occupancy.units) : null;
      const building = unit ? firstRelation(unit.buildings) : null;
      if (!occupancy || !unit || !building || !row.end_date) return null;
      return {
        leaseId: row.id,
        occupancyId: occupancy.id,
        buildingId: building.id,
        buildingName: building.name,
        unitId: unit.id,
        unitNo: unit.unit_no,
        dong: unit.dong,
        tenantName: occupancy.tenant_name,
        endDate: row.end_date,
        daysLeft: daysBetween(today, row.end_date),
      };
    })
    .filter((row): row is UpcomingLeaseExpiry => row !== null)
    .sort(
      (a, b) =>
        a.daysLeft - b.daysLeft ||
        `${a.buildingName}:${a.dong ?? ""}:${a.unitNo}`.localeCompare(
          `${b.buildingName}:${b.dong ?? ""}:${b.unitNo}`,
          "ko-KR",
        ),
    );
}
