import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  listOverdueBuildings: vi.fn(),
  listOverdueHouseholds: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mocks.from }),
}));
vi.mock("@/hooks/reactquery/overdue", () => ({
  listOverdueBuildings: mocks.listOverdueBuildings,
  listOverdueHouseholds: mocks.listOverdueHouseholds,
}));

import { getDashboardOverview, getKoreaToday } from "./apis";

function setupDashboardQueries() {
  const moveInsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
  };
  moveInsQuery.select.mockReturnValue(moveInsQuery);
  moveInsQuery.eq.mockReturnValue(moveInsQuery);
  moveInsQuery.is.mockReturnValue(moveInsQuery);
  moveInsQuery.order.mockResolvedValue({
    data: [
      {
        id: 32,
        tenant_name: "이입주",
        move_in_date: "2026-08-18",
        units: {
          id: 22,
          building_id: 2,
          unit_no: "202호",
          dong: null,
          buildings: { id: 2, name: "새봄빌라" },
        },
      },
      {
        id: 31,
        tenant_name: "김입주",
        move_in_date: "2026-08-18",
        units: {
          id: 21,
          building_id: 1,
          unit_no: "101호",
          dong: "A동",
          buildings: { id: 1, name: "그린빌라" },
        },
      },
    ],
    error: null,
  });

  const complaintsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
  };
  complaintsQuery.select.mockReturnValue(complaintsQuery);
  complaintsQuery.eq.mockReturnValue(complaintsQuery);
  complaintsQuery.is.mockResolvedValue({ data: null, count: 4, error: null });

  mocks.from.mockImplementation((table: string) =>
    table === "occupancies" ? moveInsQuery : complaintsQuery,
  );
  return { moveInsQuery, complaintsQuery };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listOverdueBuildings.mockResolvedValue([
    { id: 1, code: "B001", name: "그린빌라" },
    { id: 2, code: "B002", name: "새봄빌라" },
  ]);
  mocks.listOverdueHouseholds.mockImplementation(async (buildingId: number) =>
    buildingId === 1
      ? [{ occupancyId: 31, overdueAmount: 120_000 }, { occupancyId: 33, overdueAmount: 0 }]
      : [{ occupancyId: 32, overdueAmount: 90_000 }],
  );
});

describe("dashboard apis", () => {
  it("한국 시간 기준 날짜를 YYYY-MM-DD로 계산한다", () => {
    expect(getKoreaToday(new Date("2026-08-17T15:01:00.000Z"))).toBe("2026-08-18");
  });

  it("오늘 입주, pending 민원, 기존 미납 집계를 대시보드 값으로 조합한다", async () => {
    const { moveInsQuery, complaintsQuery } = setupDashboardQueries();

    await expect(getDashboardOverview("2026-08-18")).resolves.toEqual({
      today: "2026-08-18",
      todayMoveIns: [
        {
          occupancyId: 31,
          buildingId: 1,
          buildingName: "그린빌라",
          unitId: 21,
          unitNo: "101호",
          dong: "A동",
          tenantName: "김입주",
          moveInDate: "2026-08-18",
        },
        {
          occupancyId: 32,
          buildingId: 2,
          buildingName: "새봄빌라",
          unitId: 22,
          unitNo: "202호",
          dong: null,
          tenantName: "이입주",
          moveInDate: "2026-08-18",
        },
      ],
      pendingComplaintCount: 4,
      overdueHouseholdCount: 2,
    });

    expect(moveInsQuery.eq).toHaveBeenCalledWith("move_in_date", "2026-08-18");
    expect(moveInsQuery.eq).toHaveBeenCalledWith("status", "occupied");
    expect(moveInsQuery.is).toHaveBeenCalledWith("deleted_at", null);
    expect(moveInsQuery.is).toHaveBeenCalledWith("units.deleted_at", null);
    expect(moveInsQuery.is).toHaveBeenCalledWith("units.buildings.deleted_at", null);
    expect(complaintsQuery.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(complaintsQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(mocks.listOverdueHouseholds).toHaveBeenCalledWith(1, {
      year: 2026,
      month: 8,
      scope: "all",
    });
    expect(mocks.listOverdueHouseholds).toHaveBeenCalledWith(2, {
      year: 2026,
      month: 8,
      scope: "all",
    });
  });
});
