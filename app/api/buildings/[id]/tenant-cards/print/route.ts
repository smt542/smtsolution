import { requirePersonaApi } from "@/lib/api/requirePersona";
import { extractRequestMeta, logAccess } from "@/lib/audit/accessLog";
import { createClient } from "@/lib/supabase/server";

type TenantCardRpcRow = {
  unit_id: number;
  occupancy_id: number | null;
  unit_no: string;
  tenant_name: string | null;
  room_type_label: string | null;
  resident_count: number | null;
  move_in_date: string | null;
  is_vacant: boolean;
  is_overdue: boolean;
};

type OccupancyPhoneRow = {
  id: number;
  phone: string | null;
};

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const buildingId = Number(id);
  const sb = await createClient();
  const gate = await requirePersonaApi(sb, "manager_staff");
  if (!gate.ok) return gate.response;
  if (!Number.isSafeInteger(buildingId) || buildingId <= 0) {
    return Response.json({ error: "invalid building id" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("list_tenants", { p_building_id: buildingId });
  if (error) {
    console.error("buildings/[id]/tenant-cards/print list failed", error);
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }

  const rows = (data ?? []) as TenantCardRpcRow[];
  const occupancyIds = [
    ...new Set(
      rows
        .map((row) => row.occupancy_id)
        .filter((occupancyId): occupancyId is number => occupancyId !== null),
    ),
  ];
  const phoneByOccupancyId = new Map<number, string | null>();

  if (occupancyIds.length > 0) {
    const { data: occupancyData, error: occupancyError } = await sb
      .from("occupancies")
      .select("id, phone")
      .in("id", occupancyIds);
    if (occupancyError) {
      console.error("buildings/[id]/tenant-cards/print occupancy lookup failed", occupancyError);
      return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
    }

    for (const row of (occupancyData ?? []) as OccupancyPhoneRow[]) {
      phoneByOccupancyId.set(row.id, row.phone);
    }
  }

  const tenantCards = rows.map((row) => ({
    unitId: row.unit_id,
    unitNo: row.unit_no,
    tenantName: row.tenant_name,
    roomTypeLabel: row.room_type_label,
    residentCount: row.resident_count,
    moveInDate: row.move_in_date,
    phone: row.occupancy_id === null ? null : (phoneByOccupancyId.get(row.occupancy_id) ?? null),
    isVacant: row.is_vacant,
    isOverdue: row.is_overdue,
  }));

  const { ip, userAgent } = extractRequestMeta(request);
  await logAccess({
    event: "PRINT",
    persona: "manager_staff",
    orgId: gate.ctx.org_id ?? null,
    actorId: gate.userId,
    targetKind: "building",
    targetId: String(buildingId),
    rowCount: tenantCards.length,
    ip,
    userAgent,
  });

  return Response.json(tenantCards);
}
