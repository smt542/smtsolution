import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const authClient: { from: typeof from; auth?: unknown } = { from };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => authClient,
}));

import {
  getPlatformOverview,
  listPlatformAccounts,
  listPlatformOrganizations,
  listPointTransactions,
  chargePoints,
  updateOrganizationStatus,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("platform admin apis", () => {
  it("조직별 실제 계정·건물 수를 집계하고 snake_case를 변환한다", async () => {
    from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 1, name: "한빛관리", slug: "hanbit", status: "active", created_at: "2026-01-02T00:00:00Z" },
                { id: 2, name: "새봄관리", slug: null, status: "trial", created_at: "2026-01-01T00:00:00Z" },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "org_members") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ org_id: 1 }, { org_id: 1 }, { org_id: 2 }],
            error: null,
          }),
        };
      }
      return {
        select: () => ({
          is: vi.fn().mockResolvedValue({
            data: [{ org_id: 1 }, { org_id: 1 }],
            error: null,
          }),
        }),
      };
    });

    const result = await listPlatformOrganizations();

    expect(result).toEqual([
      expect.objectContaining({ id: 1, name: "한빛관리", accountCount: 2, buildingCount: 2 }),
      expect.objectContaining({ id: 2, name: "새봄관리", accountCount: 1, buildingCount: 0 }),
    ]);
  });

  it("org_members와 profiles를 결합해 조직별 계정 상태를 반환한다", async () => {
    const profileIn = vi.fn().mockResolvedValue({
      data: [{ user_id: "u1", username: "master", full_name: "김관리", is_active: true }],
      error: null,
    });

    from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return {
          select: vi.fn().mockResolvedValue({ data: [{ id: 7, name: "한빛관리" }], error: null }),
        };
      }
      if (table === "org_members") {
        return {
          select: () => ({
            order: vi.fn().mockResolvedValue({
              data: [{ org_id: 7, user_id: "u1", role: "platform_admin", created_at: "2026-02-01T00:00:00Z" }],
              error: null,
            }),
          }),
        };
      }
      return { select: () => ({ in: profileIn }) };
    });

    const result = await listPlatformAccounts();

    expect(profileIn).toHaveBeenCalledWith("user_id", ["u1"]);
    expect(result[0]).toEqual({
      orgId: 7,
      organizationName: "한빛관리",
      userId: "u1",
      username: "master",
      fullName: "김관리",
      role: "platform_admin",
      isActive: true,
      createdAt: "2026-02-01T00:00:00Z",
    });
  });

  it("대시보드는 DB count와 삭제되지 않은 건물 조건을 사용한다", async () => {
    const buildingIs = vi.fn().mockResolvedValue({ count: 9, error: null });
    from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return { select: vi.fn().mockResolvedValue({ count: 2, error: null }) };
      }
      if (table === "org_members") {
        return { select: vi.fn().mockResolvedValue({ count: 15, error: null }) };
      }
      return { select: () => ({ is: buildingIs }) };
    });

    await expect(getPlatformOverview()).resolves.toEqual({
      organizationCount: 2,
      accountCount: 15,
      buildingCount: 9,
    });
    expect(buildingIs).toHaveBeenCalledWith("deleted_at", null);
  });

  it("조직 목록에 포인트 잔액(sum(points))을 집계한다", async () => {
    from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 1, name: "한빛관리", slug: "hanbit", status: "active", created_at: "2026-01-02T00:00:00Z" },
                { id: 2, name: "새봄관리", slug: null, status: "trial", created_at: "2026-01-01T00:00:00Z" },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "org_members") {
        return { select: vi.fn().mockResolvedValue({ data: [{ org_id: 1 }], error: null }) };
      }
      if (table === "point_transactions") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { org_id: 1, points: 1000 },
              { org_id: 1, points: -300 },
              { org_id: 2, points: 500 },
            ],
            error: null,
          }),
        };
      }
      // buildings
      return { select: () => ({ is: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const result = await listPlatformOrganizations();
    expect(result).toEqual([
      expect.objectContaining({ id: 1, pointBalance: 700 }),
      expect.objectContaining({ id: 2, pointBalance: 500 }),
    ]);
  });

  it("포인트 내역을 조직명과 결합해 최신순으로 반환하고 type 필터를 적용한다", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: 5, org_id: 1, type: "charge", points: 1000, amount_krw: 110000, memo: "8월", created_by: "u1", created_at: "2026-08-02T00:00:00Z" },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const profileIn = vi.fn().mockResolvedValue({
      data: [{ user_id: "u1", full_name: "김운영" }],
      error: null,
    });
    from.mockImplementation((table: string) => {
      if (table === "point_transactions") return { select: () => ({ eq, order }) };
      if (table === "organizations") return { select: vi.fn().mockResolvedValue({ data: [{ id: 1, name: "한빛관리" }], error: null }) };
      return { select: () => ({ in: profileIn }) }; // profiles
    });

    const result = await listPointTransactions({ type: "charge" });

    expect(eq).toHaveBeenCalledWith("type", "charge");
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 5,
        orgId: 1,
        organizationName: "한빛관리",
        type: "charge",
        points: 1000,
        amountKrw: 110000,
        createdByName: "김운영",
      }),
    );
  });

  it("chargePoints는 로그인 사용자를 created_by로, type=charge로 INSERT한다", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "op-1" } }, error: null });
    authClient.auth = { getUser };
    from.mockImplementation((table: string) => {
      if (table === "point_transactions") return { insert };
      return { select: vi.fn() };
    });

    await chargePoints({ orgId: 3, points: 1000, amountKrw: 110000, memo: "선불" });

    expect(getUser).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith({
      org_id: 3,
      type: "charge",
      points: 1000,
      amount_krw: 110000,
      memo: "선불",
      created_by: "op-1",
    });
  });

  it("updateOrganizationStatus는 organizations status를 갱신한다", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockImplementation(() => ({ update }));

    await updateOrganizationStatus(7, "suspended");

    expect(update).toHaveBeenCalledWith({ status: "suspended" });
    expect(eq).toHaveBeenCalledWith("id", 7);
  });
});
