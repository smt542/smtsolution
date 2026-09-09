import { createClient } from "@/lib/supabase/client";

export type MoveOutStatus = "pending" | "confirmed" | "canceled" | "rejected";

export interface StaffMoveOutRequest {
  id: number;
  buildingId: number | null;
  unitId: number | null;
  occupancyId: number | null;
  buildingName: string | null;
  unitNo: string | null;
  unitDong: string | null;
  tenantName: string | null;
  phone: string | null;
  desiredDate: string;
  reason: string | null;
  status: MoveOutStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface StaffMoveOutFilters {
  buildingId?: number;
  statuses?: MoveOutStatus[];
  sort?: "created_desc" | "created_asc" | "desired_asc" | "desired_desc";
}

const SELECT = `
  id, occupancy_id, unit_id, building_id, desired_date, reason, status, created_at, resolved_at,
  units!unit_id(unit_no,dong),
  buildings!building_id(name),
  occupancies!occupancy_id(tenant_name,phone)
`;

function one<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

interface Row {
  id: number;
  occupancy_id: number | null;
  unit_id: number | null;
  building_id: number | null;
  desired_date: string;
  reason: string | null;
  status: MoveOutStatus;
  created_at: string;
  resolved_at: string | null;
  units?:
    | { unit_no?: string | null; dong?: string | null }
    | { unit_no?: string | null; dong?: string | null }[]
    | null;
  buildings?:
    | { name?: string | null }
    | { name?: string | null }[]
    | null;
  occupancies?:
    | { tenant_name?: string | null; phone?: string | null }
    | { tenant_name?: string | null; phone?: string | null }[]
    | null;
}

function toModel(row: Row): StaffMoveOutRequest {
  const unit = one<{ unit_no?: string | null; dong?: string | null }>(row.units);
  const building = one<{ name?: string | null }>(row.buildings);
  const occupancy = one<{ tenant_name?: string | null; phone?: string | null }>(
    row.occupancies,
  );
  return {
    id: row.id,
    buildingId: row.building_id,
    unitId: row.unit_id,
    occupancyId: row.occupancy_id,
    buildingName: building?.name ?? null,
    unitNo: unit?.unit_no ?? null,
    unitDong: unit?.dong ?? null,
    tenantName: occupancy?.tenant_name ?? null,
    phone: occupancy?.phone ?? null,
    desiredDate: row.desired_date,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function listStaffMoveOutRequests(
  filters: StaffMoveOutFilters = {},
): Promise<StaffMoveOutRequest[]> {
  let query = createClient()
    .from("move_out_requests")
    .select(SELECT)
    .in("status", filters.statuses ?? ["pending", "confirmed"])
    .is("resolved_at", null);

  if (filters.buildingId !== undefined) {
    query = query.eq("building_id", filters.buildingId);
  }

  const [column, ascending] =
    filters.sort === "created_asc"
      ? ["created_at", true]
      : filters.sort === "desired_asc"
        ? ["desired_date", true]
        : filters.sort === "desired_desc"
          ? ["desired_date", false]
          : ["created_at", false];
  const { data, error } = await query.order(column as string, {
    ascending: ascending as boolean,
  });

  // If an environment's related-table RLS blocks this single embed, fall back
  // to two reads (requests, then occupancies via .in("id", occupancyIds)) and
  // merge client-side. Do not add an RPC or migration for that fallback.
  if (error) throw new Error(error.message);
  return (data as unknown as Row[]).map(toModel);
}

export async function confirmMoveOut(id: number): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("move_out_requests")
    .update({
      status: "confirmed",
      resolved_at: new Date().toISOString(),
      resolved_by: auth.user?.id ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
