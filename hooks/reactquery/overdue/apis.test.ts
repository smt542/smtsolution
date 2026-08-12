import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

import { listOverdueBuildings, listOverdueHouseholds } from "./apis";

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

  it("occupancies와 units/buildings를 조인하고 없는 청구값은 명시적 placeholder로 매핑한다", async () => {
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

    const result = await listOverdueHouseholds(1);

    expect(from).toHaveBeenCalledWith("occupancies");
    expect(query.select.mock.calls[0][0]).toContain("units!inner");
    expect(query.select.mock.calls[0][0]).toContain("buildings!inner");
    expect(query.eq).toHaveBeenCalledWith("units.building_id", 1);
    expect(query.eq).toHaveBeenCalledWith("status", "occupied");
    expect(result[0]).toMatchObject({
      occupancyId: 31,
      buildingId: 1,
      buildingName: "그린빌라",
      unitId: 21,
      unitNo: "101호",
      areaPyeong: 18.5,
      tenantName: "김입주",
      overdueMonths: 0,
      overdueAmount: 0,
      lastPaymentDate: null,
      billingAvailable: false,
    });
  });
});

