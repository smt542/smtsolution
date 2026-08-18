import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

function request(query = "") {
  return new Request(`http://localhost/api/receipts/as-status/export${query ? `?${query}` : ""}`);
}

function serverClient() {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.order = vi.fn().mockResolvedValue({
    data: [{
      received_at: "2026-08-18T01:00:00.000Z",
      title: "욕실 누수",
      content: "물이 떨어집니다.",
      status: "completed",
      building: { name: "그린빌라" },
      unit: { unit_no: "101호", dong: "A동" },
      complaint_resolutions: [{
        result_content: "패킹 교체 완료",
        resolved_at: "2026-08-18T03:00:00.000Z",
        created_at: "2026-08-18T03:00:00.000Z",
      }],
    }],
    error: null,
  });
  const from = vi.fn(() => builder);
  return { client: { from }, builder, from };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/receipts/as-status/export", () => {
  it.each([
    "buildingId=0",
    "categoryId=x",
    "receivedFrom=2026-02-30",
    "receivedFrom=2026-08-31&receivedTo=2026-08-01",
  ])("잘못된 필터는 DB 조회 전에 400을 반환한다: %s", async (query) => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("RLS complaints 조회 결과를 PRD 파일명의 xlsx로 반환한다", async () => {
    const server = serverClient();
    createClient.mockResolvedValue(server.client);

    const response = await GET(request(
      "buildingId=2&categoryId=4&receivedFrom=2026-08-01&receivedTo=2026-08-31",
    ));

    expect(response.status).toBe(200);
    expect(server.from).toHaveBeenCalledWith("complaints");
    expect(server.builder.eq).toHaveBeenCalledWith("building_id", 2);
    expect(server.builder.eq).toHaveBeenCalledWith("category_id", 4);
    expect(server.builder.gte).toHaveBeenCalledWith(
      "received_at",
      "2026-07-31T15:00:00.000Z",
    );
    expect(server.builder.lte).toHaveBeenCalledWith(
      "received_at",
      "2026-08-31T14:59:59.999Z",
    );
    expect(decodeURIComponent(response.headers.get("Content-Disposition") ?? ""))
      .toMatch(/AS접수현황_\d{8}\.xlsx/);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    expect((workbook.getWorksheet(1)?.getRow(1).values as unknown[]).slice(1)).toEqual([
      "접수일",
      "건물명",
      "호실명",
      "접수내용",
      "상태",
      "처리결과",
    ]);
  });
});
