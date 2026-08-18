import { rowsToXlsxBuffer } from "@/lib/export/xlsx";
import { createClient } from "@/lib/supabase/server";
import {
  buildAsStatusWorkbookData,
  type AsStatusExportRow,
} from "./workbook";

interface ComplaintExportDbRow {
  received_at: string;
  title: string;
  content: string | null;
  status: string;
  building: { name: string } | { name: string }[] | null;
  unit: { unit_no: string; dong: string | null } | { unit_no: string; dong: string | null }[] | null;
  complaint_resolutions: {
    result_content: string | null;
    resolved_at: string | null;
    created_at: string;
  }[] | null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function validId(value: string | null) {
  if (value === null) return true;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0;
}

function validDate(value: string | null) {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function startOfKoreanDay(value: string) {
  return new Date(`${value}T00:00:00+09:00`).toISOString();
}

function endOfKoreanDay(value: string) {
  return new Date(`${value}T23:59:59.999+09:00`).toISOString();
}

function formatUnit(unit: { unit_no: string; dong: string | null } | null) {
  if (!unit) return "공용·호실 미지정";
  return [unit.dong, unit.unit_no].filter(Boolean).join(" ");
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const buildingId = params.get("buildingId");
  const categoryId = params.get("categoryId");
  const receivedFrom = params.get("receivedFrom");
  const receivedTo = params.get("receivedTo");

  if (
    !validId(buildingId)
    || !validId(categoryId)
    || !validDate(receivedFrom)
    || !validDate(receivedTo)
    || (receivedFrom !== null && receivedTo !== null && receivedFrom > receivedTo)
  ) {
    return Response.json({ error: "invalid AS status export parameters" }, { status: 400 });
  }

  const sb = await createClient();
  let query = sb
    .from("complaints")
    .select(`
      received_at,
      title,
      content,
      status,
      building:buildings!inner(name),
      unit:units(unit_no,dong),
      complaint_resolutions(result_content,resolved_at,created_at)
    `)
    .is("deleted_at", null);

  if (buildingId !== null) query = query.eq("building_id", Number(buildingId));
  if (categoryId !== null) query = query.eq("category_id", Number(categoryId));
  if (receivedFrom !== null) query = query.gte("received_at", startOfKoreanDay(receivedFrom));
  if (receivedTo !== null) query = query.lte("received_at", endOfKoreanDay(receivedTo));

  const { data, error } = await query.order("received_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as unknown as ComplaintExportDbRow[]).map<AsStatusExportRow>((row) => {
    const resolutions = [...(row.complaint_resolutions ?? [])].sort((a, b) => {
      const aDate = a.resolved_at ?? a.created_at;
      const bDate = b.resolved_at ?? b.created_at;
      return bDate.localeCompare(aDate);
    });
    return {
      receivedAt: row.received_at,
      buildingName: firstRelation(row.building)?.name ?? "",
      unitNo: formatUnit(firstRelation(row.unit)),
      title: row.title,
      content: row.content ?? "",
      status: row.status,
      resolution: resolutions[0]?.result_content ?? "처리이력 없음",
    };
  });
  const workbook = buildAsStatusWorkbookData(rows);
  const buffer = await rowsToXlsxBuffer(workbook.columns, workbook.rows);

  const now = new Date();
  const koreanNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const ymd = [
    koreanNow.getFullYear(),
    String(koreanNow.getMonth() + 1).padStart(2, "0"),
    String(koreanNow.getDate()).padStart(2, "0"),
  ].join("");
  const filename = `AS접수현황_${ymd}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="as_status_${ymd}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
