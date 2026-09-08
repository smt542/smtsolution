import { requirePersonaApi } from "@/lib/api/requirePersona";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";
import { createClient } from "@/lib/supabase/server";

const UTILITY_LABELS = {
  water: "수도",
  elec: "전기",
  gas: "가스",
} as const;

type DbUtility = keyof typeof UTILITY_LABELS;

interface UtilityLedgerRpcRow {
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  previous_reading: number | null;
  current_reading: number | null;
  usage: number | null;
  unit_price: number | null;
  resolved_unit_price: number | null;
  calc_charge: number | null;
  manual_charge: number | null;
  discount_amount: number | null;
  note: string | null;
  processed_at: string | null;
}

function isDbUtility(value: string | null): value is DbUtility {
  return value !== null && value in UTILITY_LABELS;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const buildingId = Number(params.get("buildingId"));
  const utility = params.get("utility");
  const period = params.get("period") ?? "";

  if (
    !Number.isSafeInteger(buildingId)
    || buildingId <= 0
    || !isDbUtility(utility)
    || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(period)
  ) {
    return Response.json({ error: "invalid ledger parameters" }, { status: 400 });
  }

  const sb = await createClient();
  const gate = await requirePersonaApi(sb, "manager_staff");
  if (!gate.ok) return gate.response;

  const { data: building, error: buildingError } = await sb
    .from("buildings")
    .select("name")
    .eq("id", buildingId)
    .maybeSingle();

  if (buildingError) {
    console.error("utilities/ledger building lookup failed", buildingError);
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }
  if (!building) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await sb.rpc("list_utility_rows", {
    p_building_id: buildingId,
    p_utility: utility,
    p_period: period,
  });
  if (error) {
    console.error("utilities/ledger failed", error);
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }

  const table = ((data ?? []) as UtilityLedgerRpcRow[]).map((row) => ({
    unitNo: row.dong ? `${row.dong} ${row.unit_no}` : row.unit_no,
    tenantName: row.tenant_name ?? "",
    previousReading: row.previous_reading ?? "",
    currentReading: row.current_reading ?? "",
    usage: row.usage ?? "",
    unitPrice: row.unit_price ?? row.resolved_unit_price ?? "",
    automaticCharge: row.calc_charge ?? "",
    manualCharge: row.manual_charge ?? "",
    discount: row.discount_amount ?? "",
    note: row.note ?? "",
    processedAt: row.processed_at ?? "",
  }));

  const buffer = await rowsToXlsxBuffer(
    [
      { header: "호실", key: "unitNo", width: 12 },
      { header: "입주자", key: "tenantName", width: 14 },
      { header: "전월지침", key: "previousReading", width: 12 },
      { header: "당월지침", key: "currentReading", width: 12 },
      { header: "사용량", key: "usage", width: 10 },
      { header: "단가", key: "unitPrice", width: 12 },
      { header: "자동요금", key: "automaticCharge", width: 14 },
      { header: "수동요금", key: "manualCharge", width: 14 },
      { header: "할인", key: "discount", width: 12 },
      { header: "적요", key: "note", width: 24 },
      { header: "처리일", key: "processedAt", width: 22 },
    ],
    table,
  );

  const yyyymm = period.slice(0, 7).replace("-", "");
  const filename = `${building.name}_${UTILITY_LABELS[utility]}_검침대장_${yyyymm}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="utility_ledger_${yyyymm}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
