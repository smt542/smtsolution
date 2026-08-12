// hooks/reactquery/buildings/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));
vi.mock("@/hooks/reactquery/buildingCustomerNumbers", () => ({ listCustomerNumbersByBuilding: vi.fn(async () => []) }));
vi.mock("@/hooks/reactquery/buildingVendors", () => ({ listBuildingVendorsByBuilding: vi.fn(async () => []) }));

import { listBuildings, saveBuilding, emptyFacilities } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("buildings apis", () => {
  it("listBuildings: list_buildings RPC 호출 + rows/total 분리", async () => {
    rpc.mockResolvedValue({
      data: [
        { id: 1, code: "B0001", name: "가나빌", address: "서울", manager_user_id: "u1", meter_user_id: null,
          cleaning_user_id: null, manager_name: "김관리", meter_name: null, cleaning_name: null,
          total_units: 10, occupied_units: 7, min_meter_day: 5, total: 1 },
      ],
      error: null,
    });
    const r = await listBuildings({ managerUserId: "u1", page: 1, pageSize: 20 });
    expect(rpc).toHaveBeenCalledWith("list_buildings", expect.objectContaining({
      p_manager: "u1", p_limit: 20, p_offset: 0,
    }));
    expect(r.total).toBe(1);
    expect(r.rows[0]).toMatchObject({ id: 1, name: "가나빌", managerName: "김관리", totalUnits: 10, occupiedUnits: 7 });
  });

  it("listBuildings: page 2 → offset 계산", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listBuildings({ page: 3, pageSize: 10 });
    expect(rpc).toHaveBeenCalledWith("list_buildings", expect.objectContaining({ p_limit: 10, p_offset: 20 }));
  });

  it("saveBuilding: RPC payload(snake) + 결과 파싱", async () => {
    rpc.mockResolvedValue({ data: { building_id: 42, vendors: [{ client_key: "ck1", id: 99 }] }, error: null });
    const res = await saveBuilding({
      id: null, code: "", name: "새빌딩", address: "부산",
      managerUserId: "u1", meterUserId: null, cleaningUserId: null,
      facilities: emptyFacilities(), memo: "메모",
      customerNumbers: [{ kind: "water", customerNo: "C1", billingBasis: "current", printOnBill: true }],
      vendors: [{ clientKey: "ck1", vendorType: "elevator", name: "승강기업체" }],
    });
    expect(rpc).toHaveBeenCalledWith("save_building", expect.objectContaining({
      p_id: null, p_name: "새빌딩", p_manager_user_id: "u1",
    }));
    const args = rpc.mock.calls[0][1];
    expect(args.p_customer_numbers[0]).toMatchObject({ kind: "water", customer_no: "C1", print_on_bill: true });
    expect(args.p_vendors[0]).toMatchObject({ client_key: "ck1", vendor_type: "elevator", name: "승강기업체" });
    expect(res).toEqual({ buildingId: 42, vendors: [{ clientKey: "ck1", id: 99 }] });
  });

  it("emptyFacilities: 9키 전부 {on:false, memo:''}", () => {
    const f = emptyFacilities();
    expect(Object.keys(f)).toHaveLength(9);
    expect(f.cctv).toEqual({ on: false, memo: "" });
    expect(f.fire_safety).toEqual({ on: false, memo: "" });
  });
});
