import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from }),
}));

import { listUtilityRows } from "./apis";

function mockRows(data: unknown[], error: { message: string } | null = null) {
  const order = vi.fn().mockResolvedValue({ data, error });
  const is = vi.fn(() => ({ order }));
  const eq = vi.fn(() => ({ is }));
  const select = vi.fn(() => ({ eq }));
  from.mockReturnValue({ select });
  return { select, eq, is, order };
}

describe("utilities apis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("units+occupancies를 한 번 조회하고 현재 입주 정보를 매핑한다", async () => {
    const chain = mockRows([
      {
        id: 101,
        building_id: 3,
        unit_no: "101호",
        dong: "A동",
        water_customer_no: "W-101",
        elec_customer_no: "E-101",
        elec_meter_no: "M-101",
        occupancies: [
          {
            id: 8,
            tenant_name: "이전입주자",
            status: "vacant",
            move_in_date: "2025-01-01",
            deleted_at: null,
          },
          {
            id: 9,
            tenant_name: "홍길동",
            status: "occupied",
            move_in_date: "2026-08-01",
            deleted_at: null,
          },
        ],
      },
    ]);

    const result = await listUtilityRows(3, "water");

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("units");
    expect(chain.eq).toHaveBeenCalledWith("building_id", 3);
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(result[0]).toMatchObject({
      unitId: 101,
      unitNo: "101호",
      dong: "A동",
      occupancyId: 9,
      tenantName: "홍길동",
      occupancyStatus: "occupied",
      customerNumber: "W-101",
      meterNumber: null,
    });
  });

  it("검침 테이블 연동 전 값은 null이고 공실도 행에서 유지한다", async () => {
    mockRows([
      {
        id: 201,
        building_id: 3,
        unit_no: "201호",
        occupancies: [],
      },
    ]);

    const [row] = await listUtilityRows(3, "electricity");

    expect(row).toMatchObject({
      occupancyId: null,
      tenantName: null,
      previousReading: null,
      currentReading: null,
      usage: null,
      automaticCharge: null,
      manualCharge: null,
      processedAt: null,
    });
  });

  it("가스 고객번호는 P3a 스키마 전까지 임의 생성하지 않는다", async () => {
    mockRows([
      {
        id: 301,
        building_id: 3,
        unit_no: "301호",
        water_customer_no: "W-301",
        elec_customer_no: "E-301",
        elec_meter_no: "M-301",
        occupancies: [],
      },
    ]);

    const [row] = await listUtilityRows(3, "gas");
    expect(row.customerNumber).toBeNull();
    expect(row.meterNumber).toBeNull();
  });

  it("Supabase 오류를 전달한다", async () => {
    mockRows([], { message: "조회 실패" });
    await expect(listUtilityRows(3, "water")).rejects.toThrow("조회 실패");
  });
});
