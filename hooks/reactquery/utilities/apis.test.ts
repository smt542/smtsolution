import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));

import {
  dbUtility, listUtilityRows, saveMeterReadings, saveWaterDiscount, deleteWaterDiscount, listMeterHistory,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("utilities apis", () => {
  it("dbUtility: electricity→elec, 나머지 그대로", () => {
    expect(dbUtility("electricity")).toBe("elec");
    expect(dbUtility("water")).toBe("water");
    expect(dbUtility("gas")).toBe("gas");
  });

  it("listUtilityRows: list_utility_rows RPC(elec 매핑) + snake→camel", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 101, unit_no: "101호", dong: "A동", occupancy_id: 9, tenant_name: "홍길동",
      occupancy_status: "occupied", move_in_date: "2026-08-01", customer_no: "E-101", meter_no: "M-101",
      previous_reading: 100, current_reading: 158, usage: 58, unit_price: null, calc_charge: null,
      discount_amount: null, manual_charge: null, note: null, processed_at: null, discount_type: null,
    }], error: null });

    const rows = await listUtilityRows(3, "electricity", "2026-08-01");

    expect(rpc).toHaveBeenCalledWith("list_utility_rows", { p_building_id: 3, p_utility: "elec", p_period: "2026-08-01" });
    expect(rows[0]).toMatchObject({
      unitId: 101, unitNo: "101호", dong: "A동", occupancyId: 9, tenantName: "홍길동",
      occupancyStatus: "occupied", customerNumber: "E-101", meterNumber: "M-101",
      previousReading: 100, currentReading: 158, usage: 58, automaticCharge: null,
      discountType: null, discountAmount: null,
    });
  });

  it("listUtilityRows: 수도 할인 세대 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 201, unit_no: "201호", dong: null, occupancy_id: 5, tenant_name: "김수급",
      occupancy_status: "occupied", move_in_date: null, customer_no: "W-201", meter_no: null,
      previous_reading: null, current_reading: null, usage: null, unit_price: null, calc_charge: null,
      discount_amount: 3000, manual_charge: null, note: null, processed_at: null, discount_type: "recipient",
    }], error: null });
    const [row] = await listUtilityRows(3, "water", "2026-08-01");
    expect(row).toMatchObject({ discountType: "recipient", discountAmount: 3000 });
  });

  it("saveMeterReadings: save_meter_readings payload + 결과", async () => {
    rpc.mockResolvedValue({ data: { saved: 2, period: "2026-08-01" }, error: null });
    const res = await saveMeterReadings({
      buildingId: 3, utilityType: "water", period: "2026-08-01",
      rows: [{ unit_id: 101, current_reading: "158", manual_charge: "", note: "" }],
    });
    expect(rpc).toHaveBeenCalledWith("save_meter_readings", {
      p_building_id: 3, p_utility: "water", p_period: "2026-08-01",
      p_rows: [{ unit_id: 101, current_reading: "158", manual_charge: "", note: "" }],
    });
    expect(res).toEqual({ saved: 2, period: "2026-08-01" });
  });

  it("saveWaterDiscount: unit_id onConflict upsert", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    await saveWaterDiscount({ unitId: 101, discountType: "multichild", amount: 5000, memo: "3자녀" });
    expect(from).toHaveBeenCalledWith("water_discounts");
    expect(upsert).toHaveBeenCalledWith(
      { unit_id: 101, discount_type: "multichild", amount: 5000, memo: "3자녀" },
      { onConflict: "unit_id" },
    );
  });

  it("deleteWaterDiscount: unit_id 삭제", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq }));
    from.mockReturnValue({ delete: del });
    await deleteWaterDiscount(101);
    expect(eq).toHaveBeenCalledWith("unit_id", 101);
  });

  it("listMeterHistory: 유형(elec) + period 이하 6건 + charge=calc?? manual", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [
      { period: "2026-08-01", manual_charge: 12000, calc_charge: null, unit_price: null },
      { period: "2026-07-01", manual_charge: null, calc_charge: 9000, unit_price: 900 },
    ], error: null });
    const order = vi.fn(() => ({ limit }));
    const lte = vi.fn(() => ({ order }));
    const eq2 = vi.fn(() => ({ lte }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    from.mockReturnValue({ select: () => ({ eq: eq1 }) });
    const hist = await listMeterHistory(101, "electricity", "2026-08-01");
    expect(from).toHaveBeenCalledWith("meter_readings");
    expect(eq2).toHaveBeenCalledWith("utility", "elec");
    expect(hist).toEqual([
      { period: "2026-08-01", charge: 12000, unitPrice: null },
      { period: "2026-07-01", charge: 9000, unitPrice: 900 },
    ]);
  });

  it("RPC 오류를 전달한다", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "조회 실패" } });
    await expect(listUtilityRows(3, "water", "2026-08-01")).rejects.toThrow("조회 실패");
  });
});
