import { requirePersonaApi } from "@/lib/api/requirePersona";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";
import { createClient } from "@/lib/supabase/server";

interface CmsDebitRpcRow {
  cms_member_no: string;
  holder: string | null;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  charged: number | null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const buildingId = Number(params.get("buildingId"));
  const period = params.get("period") ?? "";

  if (
    !Number.isSafeInteger(buildingId)
    || buildingId <= 0
    || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(period)
  ) {
    return Response.json({ error: "invalid cms parameters" }, { status: 400 });
  }

  const sb = await createClient();
  const gate = await requirePersonaApi(sb, "manager_staff");
  if (!gate.ok) return gate.response;

  const { data: building, error: buildingError } = await sb
    .from("buildings").select("name").eq("id", buildingId).maybeSingle();
  if (buildingError) {
    console.error("payment/cms building lookup failed", buildingError);
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }
  if (!building) return Response.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await sb.rpc("list_cms_debit_rows", {
    p_building_id: buildingId,
    p_period: period,
  });
  if (error) {
    console.error("payment/cms failed", error);
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }

  const table = ((data ?? []) as CmsDebitRpcRow[]).map((r) => ({
    cmsMemberNo: r.cms_member_no,
    holder: r.holder ?? "",
    unitNo: r.dong ? `${r.dong} ${r.unit_no}` : r.unit_no,
    tenantName: r.tenant_name ?? "",
    charged: r.charged ?? "",
  }));

  const buffer = await rowsToXlsxBuffer(
    [
      { header: "회원번호", key: "cmsMemberNo", width: 18 },
      { header: "예금주", key: "holder", width: 14 },
      { header: "호실", key: "unitNo", width: 12 },
      { header: "입주자", key: "tenantName", width: 14 },
      { header: "청구금액", key: "charged", width: 14 },
    ],
    table,
  );

  const yyyymm = period.slice(0, 7).replace("-", "");
  const filename = `${building.name}_자동이체_${yyyymm}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="cms_debit_${yyyymm}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
