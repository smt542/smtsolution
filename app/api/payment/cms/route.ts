import { requirePersonaApi } from "@/lib/api/requirePersona";
import { createClient } from "@/lib/supabase/server";
import { extractRequestMeta, logAccess } from "@/lib/audit/accessLog";

interface CmsDebitRpcRow {
  cms_member_no: string;
  holder: string | null;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  charged: number | null;
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// 선택 건물 여러 개를 한 파일로 합쳐 내려준다. buildingIds=1,2,3 (단건 buildingId도 허용).
function parseBuildingIds(params: URLSearchParams): number[] | null {
  const raw = params.get("buildingIds") ?? params.get("buildingId") ?? "";
  const ids = raw.split(",").map((value) => Number(value.trim()));
  if (ids.length === 0 || ids.length > 500) return null;
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) return null;
  return [...new Set(ids)];
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const buildingIds = parseBuildingIds(params);
  const period = params.get("period") ?? "";

  if (!buildingIds || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(period)) {
    return Response.json({ error: "invalid cms parameters" }, { status: 400 });
  }

  const sb = await createClient();
  const gate = await requirePersonaApi(sb, "manager_staff", { module: "bill_publish" });
  if (!gate.ok) return gate.response;

  const { data: buildings, error: buildingError } = await sb
    .from("buildings").select("id, code, name").in("id", buildingIds);
  if (buildingError) {
    console.error("payment/cms building lookup failed", buildingError);
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }
  const buildingById = new Map((buildings ?? []).map((building) => [building.id as number, building]));
  if (buildingIds.some((id) => !buildingById.has(id))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const table: { building: string; cmsMemberNo: string; holder: string; unitNo: string; tenantName: string; charged: number | string }[] = [];
  for (const buildingId of buildingIds) {
    const building = buildingById.get(buildingId)!;
    const { data, error } = await sb.rpc("list_cms_debit_rows", {
      p_building_id: buildingId,
      p_period: period,
    });
    if (error) {
      console.error("payment/cms failed", error);
      return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
    }
    for (const r of (data ?? []) as CmsDebitRpcRow[]) {
      table.push({
        building: `${building.code} ${building.name}`,
        cmsMemberNo: r.cms_member_no,
        holder: r.holder ?? "",
        unitNo: r.dong ? `${r.dong} ${r.unit_no}` : r.unit_no,
        tenantName: r.tenant_name ?? "",
        charged: r.charged ?? "",
      });
    }
  }

  const columns: { header: string; key: keyof (typeof table)[number] }[] = [
    { header: "건물", key: "building" },
    { header: "회원번호", key: "cmsMemberNo" },
    { header: "예금주", key: "holder" },
    { header: "호실", key: "unitNo" },
    { header: "입주자", key: "tenantName" },
    { header: "청구금액", key: "charged" },
  ];
  const csv = [
    columns.map((column) => csvCell(column.header)).join(","),
    ...table.map((row) => columns.map((column) => csvCell(row[column.key])).join(",")),
  ].join("\r\n");

  const { ip, userAgent } = extractRequestMeta(request);
  await logAccess({
    event: "EXPORT_CSV",
    persona: "manager_staff",
    orgId: gate.ctx.org_id ?? null,
    actorId: gate.userId,
    targetKind: "building",
    targetId: buildingIds.join(","),
    rowCount: table.length,
    detail: { period, buildingIds },
    ip,
    userAgent,
  });

  // 효성CMS 업로드 파일명: 다운로드 시각(KST) 기준 YYYYMMDD_HHMMSS.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  const stamp = `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
  const filename = `효성CMS_자동이체청구_${stamp}.csv`;
  // UTF-8 BOM: 엑셀에서 한글이 깨지지 않도록.
  return new Response(String.fromCharCode(0xfeff) + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="cms_debit_${stamp}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
