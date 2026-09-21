import type { FeeItemLookupRow } from "@/hooks/reactquery/feeItems";
import { requirePersonaApi } from "@/lib/api/requirePersona";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";
import { createClient } from "@/lib/supabase/server";
import { extractRequestMeta, logAccess } from "@/lib/audit/accessLog";
import { buildFeeItemWorkbookData } from "./workbook";

type FeeItemDbRow = {
  id: number;
  type_id: number;
  name: string;
  rounding: string;
  daily_proration: boolean;
  carry_over: boolean;
  is_required: boolean;
  sort_order: number;
  building_types: { label: string } | null;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const typeIdParam = params.get("typeId");
  const typeId = typeIdParam === null ? null : Number(typeIdParam);
  const requiredParam = params.get("required");

  if (
    (typeId !== null && (!Number.isSafeInteger(typeId) || typeId <= 0))
    || (requiredParam !== null && requiredParam !== "true" && requiredParam !== "false")
  ) {
    return Response.json({ error: "invalid fee-item export parameters" }, { status: 400 });
  }

  const sb = await createClient();
  const gate = await requirePersonaApi(sb, "manager_staff");
  if (!gate.ok) return gate.response;

  let query = sb
    .from("fee_items")
    .select(
      "id, type_id, name, rounding, daily_proration, carry_over, is_required, sort_order, building_types!inner(id, label)",
    )
    .is("deleted_at", null);

  if (typeId !== null) query = query.eq("type_id", typeId);
  if (requiredParam !== null) query = query.eq("is_required", requiredParam === "true");
  const q = params.get("q")?.trim();
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query.order("type_id").order("sort_order");
  if (error) {
    console.error("fee-items/export failed", error);
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }

  const rows = ((data ?? []) as unknown as FeeItemDbRow[]).map<FeeItemLookupRow>((row) => ({
    id: row.id,
    typeId: row.type_id,
    typeLabel: row.building_types?.label ?? "",
    name: row.name,
    rounding: row.rounding,
    dailyProration: row.daily_proration,
    carryOver: row.carry_over,
    isRequired: row.is_required,
    sortOrder: row.sort_order,
  }));
  const workbook = buildFeeItemWorkbookData(rows);
  const buffer = await rowsToXlsxBuffer(workbook.columns, workbook.rows);

  const { ip, userAgent } = extractRequestMeta(request);
  await logAccess({
    event: "EXPORT_XLSX",
    persona: "manager_staff",
    orgId: gate.ctx.org_id ?? null,
    actorId: gate.userId,
    targetKind: "fee_items",
    targetId: typeId === null ? null : String(typeId),
    rowCount: workbook.rows.length,
    ip,
    userAgent,
  });

  const now = new Date();
  const ymd = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const filename = `관리비항목_${ymd}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="fee_items_${ymd}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
