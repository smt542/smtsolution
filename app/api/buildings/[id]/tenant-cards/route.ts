// app/api/buildings/[id]/tenant-cards/route.ts
import { createClient } from "@/lib/supabase/server";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const buildingId = Number(id);
  const sb = await createClient();
  const { data, error } = await sb.rpc("list_tenants", { p_building_id: buildingId });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const table = (data ?? []).map((r: any) => ({
    unitNo: r.unit_no,
    tenant: r.is_vacant ? "공실" : (r.tenant_name ?? ""),
    roomType: r.room_type_label ?? "",
    resident: r.resident_count ?? "",
    moveIn: r.move_in_date ?? "",
  }));
  const buffer = await rowsToXlsxBuffer(
    [
      { header: "호실명", key: "unitNo", width: 12 }, { header: "입주자명", key: "tenant", width: 16 },
      { header: "룸타입", key: "roomType", width: 12 }, { header: "인원", key: "resident", width: 8 },
      { header: "입주일", key: "moveIn", width: 14 },
    ],
    table,
  );
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tenant-cards_${ymd}.xlsx"; filename*=UTF-8''${encodeURIComponent(`입주자카드_${ymd}.xlsx`)}`,
    },
  });
}
