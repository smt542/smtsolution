import type {
  CustomerNumberLookupKind,
  CustomerNumberLookupRow,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import { requirePersonaApi } from "@/lib/api/requirePersona";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";
import { createClient } from "@/lib/supabase/server";
import { extractRequestMeta, logAccess } from "@/lib/audit/accessLog";
import { buildCustomerNumberWorkbookData } from "./workbook";

const CUSTOMER_NUMBER_KINDS = new Set<CustomerNumberLookupKind>(["water", "common_elec"]);

interface CustomerNumberDbRow {
  id: number;
  building_id: number;
  building_code: string;
  building_name: string;
  address: string | null;
  kind: CustomerNumberLookupKind;
  customer_no: string;
  line_name: string | null;
  meter_day: number | null;
  billing_basis: "prev" | "current";
  calculation_method: "auto" | "manual";
  note: string | null;
}

function isLookupKind(value: string | null): value is CustomerNumberLookupKind {
  return value !== null && CUSTOMER_NUMBER_KINDS.has(value as CustomerNumberLookupKind);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  if (!isLookupKind(kind)) {
    return Response.json({ error: "invalid customer-number export parameters" }, { status: 400 });
  }

  const query = params.get("q")?.trim();
  const sb = await createClient();
  const gate = await requirePersonaApi(sb, "manager_staff");
  if (!gate.ok) return gate.response;

  const { data, error } = await sb.rpc("list_customer_number_lookup", {
    p_kind: kind,
    p_query: query || null,
    p_limit: 10000,
    p_offset: 0,
  });
  if (error) {
    console.error("customer-numbers/export failed", error);
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }

  const rows = ((data ?? []) as CustomerNumberDbRow[]).map<CustomerNumberLookupRow>((row) => ({
    id: row.id,
    buildingId: row.building_id,
    buildingCode: row.building_code,
    buildingName: row.building_name,
    address: row.address,
    kind: row.kind,
    customerNo: row.customer_no,
    lineName: row.line_name,
    meterDay: row.meter_day,
    billingBasis: row.billing_basis,
    calculationMethod: row.calculation_method,
    note: row.note,
  }));
  const workbook = buildCustomerNumberWorkbookData(rows, kind);
  const buffer = await rowsToXlsxBuffer(workbook.columns, workbook.rows);

  const { ip, userAgent } = extractRequestMeta(request);
  await logAccess({
    event: "EXPORT_XLSX",
    persona: "manager_staff",
    orgId: gate.ctx.org_id ?? null,
    targetKind: "customer_numbers",
    targetId: kind,
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
  const filename = `고객번호조회_${ymd}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="customer_numbers_${ymd}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
