import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from, rpc }) }));

import {
  listOverdueBuildings,
  listOverdueHouseholds,
  resolveOverdueQuery,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("overdue apis", () => {
  it("활성 건물 목록을 코드순으로 조회한다", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 1, code: "B001", name: "그린빌라", address: "서울시" }],
      error: null,
    });
    const is = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ is }));
    from.mockReturnValue({ select });

    await expect(listOverdueBuildings()).resolves.toEqual([
      { id: 1, code: "B001", name: "그린빌라", address: "서울시" },
    ]);
    expect(from).toHaveBeenCalledWith("buildings");
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(order).toHaveBeenCalledWith("code");
  });

  it("occupancy 정보에 RPC 미납 집계를 occupancy/unit 기준으로 병합한다", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.order.mockResolvedValue({
      data: [{
        id: 31,
        tenant_name: "김입주",
        payer_name: "김납부",
        phone: "010-1111-2222",
        resident_count: 2,
        vehicle_no: "12가3456",
        move_in_date: "2025-01-02",
        move_out_date: null,
        status: "occupied",
        memo: "입주 메모",
        units: {
          id: 21,
          building_id: 1,
          unit_no: "101호",
          dong: "A동",
          area_pyeong: "18.5",
          room_count: 2,
          memo: "호실 메모",
          buildings: { id: 1, name: "그린빌라", address: "서울시" },
        },
      }],
      error: null,
    });
    from.mockReturnValue(query);
    rpc.mockResolvedValue({
      data: [{
        occupancy_id: 31,
        unit_id: 21,
        overdue_amount: "135000",
        overdue_months: 2,
        last_payment_date: "2026-08-12",
        billing_available: true,
      }],
      error: null,
    });

    const result = await listOverdueHouseholds(1, {
      year: 2026,
      month: 8,
      scope: "current",
    });

    expect(from).toHaveBeenCalledWith("occupancies");
    expect(query.select.mock.calls[0][0]).toContain("units!inner");
    expect(query.select.mock.calls[0][0]).toContain("buildings!inner");
    expect(query.eq).toHaveBeenCalledWith("units.building_id", 1);
    expect(query.eq).toHaveBeenCalledWith("status", "occupied");
    expect(rpc).toHaveBeenCalledWith("list_overdue_aggregates", {
      p_building_id: 1,
      p_target_year: 2026,
      p_target_month: 8,
      p_scope: "current",
    });
    expect(result[0]).toMatchObject({
      occupancyId: 31,
      buildingId: 1,
      buildingName: "그린빌라",
      unitId: 21,
      unitNo: "101호",
      areaPyeong: 18.5,
      tenantName: "김입주",
      overdueMonths: 2,
      overdueAmount: 135_000,
      lastPaymentDate: "2026-08-12",
      billingAvailable: true,
    });
  });

  it("생략되거나 잘못된 조회 조건은 현재 연월과 전체 범위로 정규화한다", () => {
    const now = new Date(2026, 7, 18);

    expect(resolveOverdueQuery({}, now)).toEqual({ year: 2026, month: 8, scope: "all" });
    expect(resolveOverdueQuery({ year: 0, month: 13 }, now)).toEqual({
      year: 2026,
      month: 8,
      scope: "all",
    });
  });
});

