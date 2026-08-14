import type {
  CustomerNumberKind,
  CustomerNumberLookupRow,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";
import { createClient } from "@/lib/supabase/server";
import { buildCustomerNumberWorkbookData } from "./workbook";

const CUSTOMER_NUMBER_KINDS = new Set<CustomerNumberKind>([
  "water",
  "common_elec",
  "elec",
  "gas",
]);

interface CustomerNumberDbRow {
  id: number;
  building_id: number;
  buildings: { name: string } | null;
  kind: CustomerNumberKind;
  customer_no: string;
  holder_name: string | null;
  meter_day: number | null;
  billing_basis: "prev" | "current";
  print_on_bill: boolean;
}

function isCustomerNumberKind(value: string | null): value is CustomerNumberKind {
  return value !== null && CUSTOMER_NUMBER_KINDS.has(value as CustomerNumberKind);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const buildingIdParam = params.get("buildingId");
  const buildingId = buildingIdParam === null ? null : Number(buildingIdParam);
  const kindParam = params.get("kind");

  if (
    (buildingId !== null && (!Number.isSafeInteger(buildingId) || buildingId <= 0))
    || (kindParam !== null && !isCustomerNumberKind(kindParam))
  ) {
    return Response.json({ error: "invalid customer-number export parameters" }, { status: 400 });
  }

  const sb = await createClient();
  let query = sb
    .from("building_customer_numbers")
    .select(
      "id, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, building_id, buildings!inner(id, name)",
    )
    .is("deleted_at", null);

  if (buildingId !== null) query = query.eq("building_id", buildingId);
  if (kindParam !== null) query = query.eq("kind", kindParam);
  const q = params.get("q")?.trim();
  if (q) query = query.or(`customer_no.ilike.%${q}%,holder_name.ilike.%${q}%`);

  const { data, error } = await query.order("building_id").order("sort_order");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as unknown as CustomerNumberDbRow[]).map<CustomerNumberLookupRow>(
    (row) => ({
      id: row.id,
      buildingId: row.building_id,
      buildingName: row.buildings?.name ?? "",
      kind: row.kind,
      customerNo: row.customer_no,
      holderName: row.holder_name,
      meterDay: row.meter_day,
      billingBasis: row.billing_basis,
      printOnBill: row.print_on_bill,
    }),
  );
  const workbook = buildCustomerNumberWorkbookData(rows);
  const buffer = await rowsToXlsxBuffer(workbook.columns, workbook.rows);

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
