import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();
const authClient = { from, rpc };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => authClient,
}));

import {
  getPlatformOverview,
  listPlatformAccounts,
  listPlatformOrganizations,
  listPointTransactions,
  adjustPoints,
  chargePoints,
  updateOrganizationStatus,
  updatePlatformOrganization,
  setPlatformOrganizationDeleted,
} from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: [], error: null });
});

describe("platform admin apis", () => {
  it("조직별 실제 계정·건물 수를 집계하고 snake_case를 변환한다", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 1,
          name: "한빛관리",
          slug: "hanbit",
          status: "active",
          created_at: "2026-01-02T00:00:00Z",
          phone: null,
          deleted_at: null,
          account_count: 2,
          building_count: 2,
          ledger_balance: 700,
          reserved_points: 100,
          available_points: 600,
          total_count: 2,
        },
        {
          id: 2,
          name: "새봄관리",
          slug: null,
          status: "trial",
          created_at: "2026-01-01T00:00:00Z",
          phone: null,
          deleted_at: null,
          account_count: 1,
          building_count: 0,
          ledger_balance: 500,
          reserved_points: 0,
          available_points: 500,
          total_count: 2,
        },
      ],
      error: null,
    });

    const result = await listPlatformOrganizations();

    expect(result.rows).toEqual([
      expect.objectContaining({ id: 1, name: "한빛관리", accountCount: 2, buildingCount: 2 }),
      expect.objectContaining({ id: 2, name: "새봄관리", accountCount: 1, buildingCount: 0 }),
    ]);
    expect(result.totalCount).toBe(2);
    expect(rpc).toHaveBeenCalledWith("platform_list_organizations", {
      p_search: null,
      p_include_deleted: false,
      p_limit: 25,
      p_offset: 0,
    });
  });

  it("org_members와 profiles를 결합해 조직별 계정 상태를 반환한다", async () => {
    const profileIn = vi.fn().mockResolvedValue({
      data: [{ user_id: "u1", phone: "010-1234-5678" }],
      error: null,
    });
    const profileSelect = vi.fn(() => ({ in: profileIn }));
    from.mockReturnValue({ select: profileSelect });
    rpc.mockResolvedValue({
      data: [{
        org_id: 7,
        organization_name: "한빛관리",
        user_id: "u1",
        username: "master",
        full_name: "김관리",
        role: "platform_admin",
        staff_type: "manager_staff",
        feature_permissions: ["accounts"],
        is_active: true,
        created_at: "2026-02-01T00:00:00Z",
        total_count: 1,
      }],
      error: null,
    });

    const result = await listPlatformAccounts();

    expect(result.rows[0]).toEqual({
      orgId: 7,
      organizationName: "한빛관리",
      userId: "u1",
      username: "master",
      fullName: "김관리",
      phone: "010-1234-5678",
      role: "platform_admin",
      staffType: "manager_staff",
      permissions: ["accounts"],
      isActive: true,
      createdAt: "2026-02-01T00:00:00Z",
    });
    expect(rpc).toHaveBeenCalledWith("platform_list_accounts", {
      p_search: null,
      p_limit: 25,
      p_offset: 0,
    });
    expect(profileSelect).toHaveBeenCalledWith("user_id, phone");
    expect(profileIn).toHaveBeenCalledWith("user_id", ["u1"]);
  });

  it("조직 상태 필터는 기존 목록 RPC 결과를 표시 계층에서 분류한다", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 1,
          name: "운영사",
          slug: "active",
          status: "active",
          created_at: "2026-01-04T00:00:00Z",
          phone: null,
          deleted_at: null,
          account_count: 1,
          building_count: 1,
          ledger_balance: 0,
          reserved_points: 0,
          available_points: 0,
          total_count: 4,
        },
        {
          id: 2,
          name: "체험사",
          slug: "trial",
          status: "trial",
          created_at: "2026-01-03T00:00:00Z",
          phone: null,
          deleted_at: null,
          account_count: 1,
          building_count: 1,
          ledger_balance: 0,
          reserved_points: 0,
          available_points: 0,
          total_count: 4,
        },
        {
          id: 3,
          name: "정지사",
          slug: "suspended",
          status: "suspended",
          created_at: "2026-01-02T00:00:00Z",
          phone: null,
          deleted_at: null,
          account_count: 1,
          building_count: 1,
          ledger_balance: 0,
          reserved_points: 0,
          available_points: 0,
          total_count: 4,
        },
        {
          id: 4,
          name: "해지사",
          slug: "terminated",
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
          phone: null,
          deleted_at: "2026-08-01T00:00:00Z",
          account_count: 1,
          building_count: 1,
          ledger_balance: 0,
          reserved_points: 0,
          available_points: 0,
          total_count: 4,
        },
      ],
      error: null,
    });

    const result = await listPlatformOrganizations({ status: "operating", pageSize: 1 });

    expect(result.rows.map((row) => row.name)).toEqual(["운영사"]);
    expect(result.totalCount).toBe(2);
    expect(rpc).toHaveBeenCalledWith("platform_list_organizations", {
      p_search: null,
      p_include_deleted: true,
      p_limit: 100,
      p_offset: 0,
    });
  });

  it("대시보드는 활성 조직 count와 삭제되지 않은 건물 조건을 사용한다", async () => {
    const organizationEq = vi.fn().mockResolvedValue({ count: 1, error: null });
    const organizationSelect = vi.fn(() => ({ eq: organizationEq }));
    const buildingIs = vi.fn().mockResolvedValue({ count: 9, error: null });
    from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return { select: organizationSelect };
      }
      if (table === "org_members") {
        return { select: vi.fn().mockResolvedValue({ count: 15, error: null }) };
      }
      return { select: () => ({ is: buildingIs }) };
    });

    await expect(getPlatformOverview()).resolves.toEqual({
      activeOrganizationCount: 1,
      accountCount: 15,
      buildingCount: 9,
    });
    expect(organizationSelect).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(organizationEq).toHaveBeenCalledWith("status", "active");
    expect(buildingIs).toHaveBeenCalledWith("deleted_at", null);
  });

  it("조직 목록에 포인트 잔액(sum(points))을 집계한다", async () => {
    rpc.mockResolvedValue({
      data: [{
        id: 1,
        name: "한빛관리",
        slug: "hanbit",
        status: "active",
        created_at: "2026-01-02T00:00:00Z",
        phone: null,
        deleted_at: null,
        account_count: 1,
        building_count: 0,
        ledger_balance: 700,
        reserved_points: 100,
        available_points: 600,
        total_count: 1,
      }],
      error: null,
    });

    const result = await listPlatformOrganizations();
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 1,
        pointBalance: 700,
        ledgerBalance: 700,
        reservedPoints: 100,
        availablePoints: 600,
      }),
    ]);
  });

  it("포인트 내역을 조직명과 결합해 최신순으로 반환하고 type 필터를 적용한다", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 5,
          org_id: 1,
          organization_name: "한빛관리",
          type: "charge",
          points: 1000,
          amount_krw: 110000,
          memo: "8월",
          created_by: "u1",
          created_by_name: "김운영",
          created_at: "2026-08-02T00:00:00Z",
          total_count: 1,
        },
      ],
      error: null,
    });

    const result = await listPointTransactions({ type: "charge" });

    expect(result.rows[0]).toEqual(
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
    expect(result.nextCursor).toEqual({
      createdAt: "2026-08-02T00:00:00Z",
      id: 5,
    });
    expect(rpc).toHaveBeenCalledWith("platform_list_point_transactions", {
      p_type: "charge",
      p_before_created_at: null,
      p_before_id: null,
      p_limit: 50,
    });
  });

  it("chargePoints는 원장 쓰기 RPC를 호출한다", async () => {
    rpc.mockResolvedValue({ data: { ok: true, transaction_id: 9 }, error: null });

    await chargePoints({ orgId: 3, points: 1000, amountKrw: 110000, memo: "선불" });

    expect(rpc).toHaveBeenCalledWith("platform_record_point_charge", {
      p_org_id: 3,
      p_points: 1000,
      p_amount_krw: 110000,
      p_memo: "선불",
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

  it("adjustPoints는 조정 구분과 사유를 원장 쓰기 RPC에 전달한다", async () => {
    rpc.mockResolvedValue({ data: { ok: true, transaction_id: 10 }, error: null });

    await adjustPoints({
      orgId: 3,
      kind: "refund",
      points: -500,
      amountKrw: 5500,
      memo: "중복 충전 환불",
    });

    expect(rpc).toHaveBeenCalledWith("platform_record_point_adjustment", {
      p_org_id: 3,
      p_kind: "refund",
      p_points: -500,
      p_amount_krw: 5500,
      p_memo: "중복 충전 환불",
    });
  });

  it("adjustPoints는 활성 예약을 침범한 구조화 오류를 사용자 메시지로 변환한다", async () => {
    rpc.mockResolvedValue({
      data: { ok: false, code: "POINTS_RESERVED", reserved_points: 300 },
      error: null,
    });

    await expect(
      adjustPoints({ orgId: 3, kind: "deduction", points: -500, memo: "회수" }),
    ).rejects.toThrow("활성 메시지 예약 300 P를 침범해 조정할 수 없습니다.");
  });

  it("adjustPoints는 차감에 양수 포인트를 허용하지 않는다", async () => {
    await expect(
      adjustPoints({ orgId: 3, kind: "deduction", points: 500, memo: "오지급 회수" }),
    ).rejects.toThrow("차감·환불 포인트는 음수여야 합니다.");
  });

  it("listPlatformOrganizations는 기본적으로 deleted_at is null만 조회한다", async () => {
    await listPlatformOrganizations();
    expect(rpc).toHaveBeenCalledWith(
      "platform_list_organizations",
      expect.objectContaining({ p_include_deleted: false }),
    );
  });

  it("updatePlatformOrganization은 name/slug/phone을 update한다", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockImplementation(() => ({ update }));
    await updatePlatformOrganization(7, { name: "새이름", slug: "newslug", phone: "021234" });
    expect(update).toHaveBeenCalledWith({ name: "새이름", slug: "newslug", phone: "021234" });
    expect(eq).toHaveBeenCalledWith("id", 7);
  });

  it("setPlatformOrganizationDeleted(false)는 deleted_at을 null로 되돌린다", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockImplementation(() => ({ update }));
    await setPlatformOrganizationDeleted(7, false);
    expect(update).toHaveBeenCalledWith({ deleted_at: null });
  });
});
