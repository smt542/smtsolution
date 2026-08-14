import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));
vi.mock("@/hooks/reactquery/unitMeters", () => ({ listMetersByUnit: vi.fn(async () => []) }));
vi.mock("@/hooks/reactquery/unitAccounts", () => ({ listAccountsByUnit: vi.fn(async () => []) }));
vi.mock("@/hooks/reactquery/leaseContracts", () => ({ getLeaseByOccupancy: vi.fn(async () => null) }));
vi.mock("@/hooks/reactquery/occupancyHistory", () => ({ listHistoryByUnit: vi.fn(async () => []) }));
import { listTenants, saveUnitOccupancy } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("occupancies hub apis", () => {
  it("listTenants: list_tenants RPC + 매핑", async () => {
    rpc.mockResolvedValue({ data: [{ unit_id:3, occupancy_id:9, unit_no:"101", tenant_name:"김입주", phone:"010-1111-2222", room_type_label:"원룸", resident_count:2, move_in_date:"2026-01-01", is_vacant:false, is_overdue:false }], error:null });
    const r = await listTenants(7);
    expect(rpc).toHaveBeenCalledWith("list_tenants", { p_building_id: 7 });
    expect(r[0]).toMatchObject({ unitId:3, occupancyId:9, unitNo:"101", tenantName:"김입주", phone:"010-1111-2222", roomTypeLabel:"원룸", isVacant:false });
  });
  it("saveUnitOccupancy: RPC payload(snake) + 결과 파싱", async () => {
    rpc.mockResolvedValue({ data: { unit_id:3, occupancy_id:9 }, error:null });
    const res = await saveUnitOccupancy({
      buildingId:7, unitId:null, occupancyId:null,
      unit:{ unitNo:"101", floor:3, usageType:"commercial" },
      occupancy:{ tenantName:"김입주", payerName:"김입주", phone:"010", roomTypeId:1, moveInDate:"2026-01-01", status:"occupied",
        billingEnabled:true, printEnabled:true, lateFeeEnabled:true, singlePrint:false },
      meters:[{ utility:"water", meterNo:"M1", customerNo:"C1" }],
      accounts:[{ kind:"mgmt", bank:"국민", account:"111", holder:"김" }],
      lease:{ deposit:1000000, monthlyRent:500000, expiryAlert:false },
    });
    expect(rpc).toHaveBeenCalledWith("save_unit_occupancy", expect.objectContaining({ p_building_id:7, p_unit_id:null }));
    const args = rpc.mock.calls[0][1];
    expect(args.p_unit).toMatchObject({ unit_no:"101", floor:3, usage_type:"commercial" });
    expect(args.p_occupancy).toMatchObject({ tenant_name:"김입주", phone:"010", room_type_id:1, billing_enabled:true });
    expect(args.p_meters[0]).toMatchObject({ utility:"water", meter_no:"M1", customer_no:"C1" });
    expect(args.p_accounts[0]).toMatchObject({ kind:"mgmt", bank:"국민" });
    expect(args.p_lease).toMatchObject({ deposit:1000000, monthly_rent:500000 });
    expect(res).toEqual({ unitId:3, occupancyId:9 });
  });
});
