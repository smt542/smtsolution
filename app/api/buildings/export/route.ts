import { requirePersonaApi } from "@/lib/api/requirePersona";
import { createClient } from "@/lib/supabase/server";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";
import { extractRequestMeta, logAccess } from "@/lib/audit/accessLog";

const VENDOR_NONE = "";
type BuildingExportRow = {
  name: string; address: string | null; manager_name: string | null;
  meter_name: string | null; cleaning_name: string | null; min_meter_day: number | null;
  total_units: unknown; occupied_units: unknown;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const meter = p.get("meter") || null;

  const sb = await createClient();
  const gate = await requirePersonaApi(sb, "manager_staff");
  if (!gate.ok) return gate.response;

  const { data, error } = await sb.rpc("list_buildings", {
    p_search: p.get("search") || null,
    p_manager: p.get("manager") || null,
    p_meter: meter,
    p_cleaning: p.get("cleaning") || null,
    p_limit: 100000,
    p_offset: 0,
  });
  if (error) {
    console.error("buildings/export failed", error);
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }

  let rows = (data ?? []) as BuildingExportRow[];
  // 검침담당자 필터가 있으면 검침일(min_meter_day) 오름차순
  if (meter) rows = [...rows].sort((a, b) => (a.min_meter_day ?? 99) - (b.min_meter_day ?? 99));

  const table = rows.map((r) => ({
    name: r.name,
    address: r.address ?? VENDOR_NONE,
    manager: r.manager_name ?? VENDOR_NONE,
    meterStaff: r.meter_name ?? VENDOR_NONE,
    cleaning: r.cleaning_name ?? VENDOR_NONE,
    meterDay: r.min_meter_day ?? VENDOR_NONE,
    totalUnits: Number(r.total_units ?? 0),
    occupiedUnits: Number(r.occupied_units ?? 0),
  }));

  const buffer = await rowsToXlsxBuffer(
    [
      { header: "건물명", key: "name", width: 24 },
      { header: "주소", key: "address", width: 32 },
      { header: "관리담당자", key: "manager", width: 14 },
      { header: "검침담당자", key: "meterStaff", width: 14 },
      { header: "청소담당자", key: "cleaning", width: 14 },
      { header: "검침일", key: "meterDay", width: 8 },
      { header: "총세대수", key: "totalUnits", width: 10 },
      { header: "입주세대수", key: "occupiedUnits", width: 10 },
    ],
    table,
  );

  const { ip, userAgent } = extractRequestMeta(request);
  await logAccess({
    event: "EXPORT_XLSX",
    persona: "manager_staff",
    orgId: gate.ctx.org_id ?? null,
    targetKind: "buildings",
    rowCount: table.length,
    ip,
    userAgent,
  });

  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="buildings_${ymd}.xlsx"; filename*=UTF-8''${encodeURIComponent(`건물목록_${ymd}.xlsx`)}`,
    },
  });
}
