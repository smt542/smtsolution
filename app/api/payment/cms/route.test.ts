import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

const rpcRows = [
  {
    cms_member_no: "A2",
    holder: "김예금",
    unit_no: "102호",
    dong: "A동",
    tenant_name: "김입주",
    charged: 120_000,
  },
  {
    cms_member_no: "A1",
    holder: null,
    unit_no: "101호",
    dong: null,
    tenant_name: null,
    charged: null,
  },
];

function request(query: string) {
  return new Request(`http://localhost/api/payment/cms?${query}`);
}

function serverClient({
  building = { name: "그린 빌라" },
  buildingError = null,
  rows = rpcRows,
  rpcError = null,
}: {
  building?: { name: string } | null;
  buildingError?: { message: string } | null;
  rows?: typeof rpcRows;
  rpcError?: { message: string } | null;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: building,
    error: buildingError,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockImplementation((name: string) =>
    name === "current_user_is_manager_staff"
      ? Promise.resolve({ data: true, error: null })
      : name === "get_my_context"
      ? Promise.resolve({ data: [{ org_id: 10, role: "org_owner", permissions: [] }], error: null })
      : Promise.resolve({ data: rows, error: rpcError }),
  );
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
  return { client: { from, rpc, auth: { getUser } }, from, rpc, select, eq, maybeSingle, getUser };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/payment/cms", () => {
  it.each([
    "buildingId=0&period=2026-08-01",
    "buildingId=3&period=2026-08-02",
  ])("잘못된 파라미터는 400: %s", async (query) => {
    const response = await GET(request(query));

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("RLS 건물 조회가 비면 403을 반환한다", async () => {
    const server = serverClient({ building: null });
    createClient.mockResolvedValue(server.client);

    const response = await GET(request("buildingId=3&period=2026-08-01"));

    expect(response.status).toBe(403);
    expect(server.rpc).not.toHaveBeenCalledWith("list_cms_debit_rows", expect.anything());
  });

  it("CMS RPC 결과를 한글 파일명의 5개 열 xlsx로 반환한다", async () => {
    const server = serverClient();
    createClient.mockResolvedValue(server.client);

    const response = await GET(request("buildingId=3&period=2026-08-01"));

    expect(response.status).toBe(200);
    expect(server.from).toHaveBeenCalledWith("buildings");
    expect(server.rpc).toHaveBeenCalledWith("list_cms_debit_rows", {
      p_building_id: 3,
      p_period: "2026-08-01",
    });
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).not.toBeNull();
    expect(decodeURIComponent(contentDisposition ?? "")).toContain("자동이체");
    expect(contentDisposition).toContain("202608");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const worksheet = workbook.getWorksheet(1);
    expect((worksheet?.getRow(1).values as unknown[]).slice(1)).toEqual([
      "회원번호",
      "예금주",
      "호실",
      "입주자",
      "청구금액",
    ]);
  });
});
