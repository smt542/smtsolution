import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));

const getBillPageData = vi.fn();
vi.mock("@/app/(staff)/staff/(app)/bill/data", () => ({
  getBillPageData: (...args: unknown[]) => getBillPageData(...args),
}));

import { GET } from "./route";

const pageData = {
  buildings: [{ id: 7, code: "B007", name: "행복빌라", address: "서울시" }],
  companyName: "한빛관리",
  accounts: [],
  customerNotice: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  rpc.mockImplementation((name: string) => {
    if (name === "get_my_context") {
      return Promise.resolve({
        data: [{ org_id: 10, role: "staff", permissions: ["bill_publish"] }],
        error: null,
      });
    }
    if (name === "current_user_is_manager_staff") {
      return Promise.resolve({ data: true, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  getBillPageData.mockResolvedValue(pageData);
});

describe("GET /api/bill/page-data", () => {
  it("로그인하지 않았으면 401을 반환한다", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    expect((await GET()).status).toBe(401);
    expect(getBillPageData).not.toHaveBeenCalled();
  });

  it("bill_publish 권한이 없으면 403을 반환한다", async () => {
    rpc.mockImplementation((name: string) => name === "get_my_context"
      ? Promise.resolve({ data: [{ org_id: 10, role: "staff", permissions: [] }], error: null })
      : Promise.resolve({ data: true, error: null }));

    expect((await GET()).status).toBe(403);
    expect(getBillPageData).not.toHaveBeenCalled();
  });

  it("관리 직원 persona가 아니면 403을 반환한다", async () => {
    rpc.mockImplementation((name: string) => name === "get_my_context"
      ? Promise.resolve({ data: [{ org_id: 10, role: "org_owner", permissions: [] }], error: null })
      : Promise.resolve({ data: false, error: null }));

    expect((await GET()).status).toBe(403);
    expect(getBillPageData).not.toHaveBeenCalled();
  });

  it("허용된 조직의 페이지 데이터를 no-store 응답으로 반환한다", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(pageData);
    expect(getBillPageData).toHaveBeenCalledWith(10);
  });

  it("페이지 데이터 조회 실패 메시지를 외부에 노출하지 않는다", async () => {
    getBillPageData.mockRejectedValue(new Error("database detail"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "서류 발행 정보를 불러오지 못했습니다." });
  });
});
