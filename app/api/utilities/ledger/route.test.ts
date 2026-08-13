import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, rowsToXlsxBuffer } = vi.hoisted(() => ({
  createClient: vi.fn(),
  rowsToXlsxBuffer: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/export/xlsx", () => ({ rowsToXlsxBuffer }));

import { GET } from "./route";

const rpcRow = {
  unit_id: 101,
  unit_no: "101호",
  dong: "A동",
  tenant_name: "홍길동",
  previous_reading: 100,
  current_reading: 110,
  usage: 10,
  unit_price: 850,
  resolved_unit_price: 900,
  calc_charge: 8500,
  manual_charge: null,
  discount_amount: 500,
  note: "정상",
  processed_at: "2026-08-13T00:00:00Z",
};

function request(query: string) {
  return new Request(`http://localhost/api/utilities/ledger?${query}`);
}

function serverClient({
  building = { name: "그린 빌라" },
  buildingError = null,
  rows = [rpcRow],
  rpcError = null,
}: {
  building?: { name: string } | null;
  buildingError?: { message: string } | null;
  rows?: typeof rpcRow[];
  rpcError?: { message: string } | null;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: building,
    error: buildingError,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({ data: rows, error: rpcError });
  return { client: { from, rpc }, from, rpc, select, eq, maybeSingle };
}

beforeEach(() => {
  vi.clearAllMocks();
  rowsToXlsxBuffer.mockResolvedValue(Buffer.from([1, 2, 3]));
});

describe("GET /api/utilities/ledger", () => {
  it.each([
    "utility=water&period=2026-08-01",
    "buildingId=x&utility=water&period=2026-08-01",
    "buildingId=3&utility=electricity&period=2026-08-01",
    "buildingId=3&utility=water&period=2026-08-02",
  ])("잘못된 파라미터는 400: %s", async (query) => {
    const response = await GET(request(query));

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("RLS 건물 조회가 비면 403을 반환한다", async () => {
    const server = serverClient({ building: null });
    createClient.mockResolvedValue(server.client);

    const response = await GET(request("buildingId=3&utility=water&period=2026-08-01"));

    expect(response.status).toBe(403);
    expect(server.rpc).not.toHaveBeenCalled();
  });

  it("검침 RPC 결과를 11개 열의 xlsx 데이터로 매핑한다", async () => {
    const server = serverClient();
    createClient.mockResolvedValue(server.client);

    const response = await GET(request("buildingId=3&utility=elec&period=2026-08-01"));

    expect(response.status).toBe(200);
    expect(server.from).toHaveBeenCalledWith("buildings");
    expect(server.rpc).toHaveBeenCalledWith("list_utility_rows", {
      p_building_id: 3,
      p_utility: "elec",
      p_period: "2026-08-01",
    });
    expect(rowsToXlsxBuffer).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ header: "호실", key: "unitNo" }),
        expect.objectContaining({ header: "단가", key: "unitPrice" }),
        expect.objectContaining({ header: "처리일", key: "processedAt" }),
      ]),
      [{
        unitNo: "A동 101호",
        tenantName: "홍길동",
        previousReading: 100,
        currentReading: 110,
        usage: 10,
        unitPrice: 850,
        automaticCharge: 8500,
        manualCharge: "",
        discount: 500,
        note: "정상",
        processedAt: "2026-08-13T00:00:00Z",
      }],
    );
  });

  it("한글 파일명을 RFC 5987로 인코딩한다", async () => {
    createClient.mockResolvedValue(serverClient().client);

    const response = await GET(request("buildingId=3&utility=elec&period=2026-08-01"));

    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toContain(
      `filename*=UTF-8''${encodeURIComponent("그린 빌라_전기_검침대장_202608.xlsx")}`,
    );
  });

  it("RPC 오류는 500 JSON을 반환한다", async () => {
    createClient.mockResolvedValue(serverClient({
      rows: [],
      rpcError: { message: "조회 실패" },
    }).client);

    const response = await GET(request("buildingId=3&utility=gas&period=2026-08-01"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "조회 실패" });
  });
});
