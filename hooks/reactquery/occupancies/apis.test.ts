import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));
vi.mock("@/hooks/reactquery/unitMeters", () => ({ listMetersByUnit: vi.fn(async () => []) }));
vi.mock("@/hooks/reactquery/unitAccounts", () => ({ listAccountsByUnit: vi.fn(async () => []) }));
vi.mock("@/hooks/reactquery/leaseContracts", () => ({ getLeaseByOccupancy: vi.fn(async () => null) }));
vi.mock("@/hooks/reactquery/occupancyHistory", () => ({ listHistoryByUnit: vi.fn(async () => []) }));
import { cancelMoveOutSchedule, executeMoveOut, getUnitOccupancyFull, listTenants, saveUnitOccupancy, scheduleMoveOut } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("occupancies hub apis", () => {
  it("listTenants: list_tenants RPC + 매핑", async () => {
    rpc.mockImplementation((name: string) => name === "execute_due_move_outs"
      ? Promise.resolve({ data: 0, error: null })
      : Promise.resolve({ data: [{ unit_id:3, occupancy_id:9, unit_no:"101", tenant_name:"김입주", phone:"010-1111-2222", room_type_label:"원룸", resident_count:2, move_in_date:"2026-01-01", is_vacant:false, is_overdue:false }], error:null }));
    const r = await listTenants(7);
    expect(rpc).toHaveBeenNthCalledWith(1, "execute_due_move_outs");
    expect(rpc).toHaveBeenCalledWith("list_tenants", { p_building_id: 7 });
    expect(r[0]).toMatchObject({ unitId:3, occupancyId:9, unitNo:"101", tenantName:"김입주", phone:"010-1111-2222", roomTypeLabel:"원룸", isVacant:false });
  });
  it("saveUnitOccupancy: RPC payload(snake) + 결과 파싱", async () => {
    rpc.mockResolvedValue({ data: { unit_id:3, occupancy_id:9 }, error:null });
    const res = await saveUnitOccupancy({
      buildingId:7, unitId:null, occupancyId:null,
      unit:{ unitNo:"101", floor:3, usageType:"commercial" },
      occupancy:{ tenantName:"김입주", payerName:"김입주", phone:"010", faxNumber:"02-1234", roomTypeId:1, moveInDate:"2026-01-01", status:"occupied",
        billingEnabled:true, printEnabled:true, lateFeeEnabled:true, singlePrint:false,
        transferMethod:"auto_transfer", billNameDisplay:"name", billDelivery:"alimtalk", billAuth:true },
      meters:[{ utility:"water", meterNo:"M1", customerNo:"C1" }],
      accounts:[{ kind:"mgmt", bank:"국민", account:"111", holder:"김", cmsMemberNo:"CMS1", payerNo:"PAYER1" }],
      lease:{ deposit:1000000, monthlyRent:500000, expiryAlert:false },
      property:{ propertyName:"101호 매물", propertyType:"oneroom", dealType:"direct", rentType:"month", facilities:["에어컨"] },
    });
    expect(rpc).toHaveBeenCalledWith("save_unit_occupancy_full", expect.objectContaining({ p_building_id:7, p_unit_id:null }));
    const args = rpc.mock.calls[0][1];
    expect(args.p_unit).toMatchObject({ unit_no:"101", floor:3, usage_type:"commercial" });
    expect(args.p_occupancy).toMatchObject({
      tenant_name:"김입주", phone:"010", room_type_id:1, billing_enabled:true,
      transfer_method:"auto_transfer", bill_name_display:"name", bill_delivery:"alimtalk", bill_auth:true,
    });
    expect(args.p_meters[0]).toMatchObject({ utility:"water", meter_no:"M1", customer_no:"C1" });
    expect(args.p_accounts[0]).toMatchObject({ kind:"mgmt", bank:"국민", cms_member_no:"CMS1", payer_no:"PAYER1" });
    expect(args.p_fax_number).toBe("02-1234");
    expect(args.p_lease).toMatchObject({ deposit:1000000, monthly_rent:500000 });
    expect(args.p_property).toMatchObject({ property_name:"101호 매물", property_type:"oneroom", facilities:["에어컨"] });
    expect(res).toEqual({ unitId:3, occupancyId:9 });
  });

  it("상세 진입에서도 due-sweep 후 신규 고지서·퇴실 예약 필드를 로드한다", async () => {
    rpc.mockResolvedValue({ data: 0, error: null });
    const unitSingle = vi.fn().mockResolvedValue({
      data: { id: 3, building_id: 7, unit_no: "101", dong: null, area_pyeong: null, room_count: null, floor: 1, usage_type: "residential", memo: null },
      error: null,
    });
    const occupancySingle = vi.fn().mockResolvedValue({
      data: {
        id: 9, unit_id: 3, tenant_name: "김입주", payer_name: "김입주", phone: "010", phone2: null, phone3: null, fax_number: "02-1234",
        vehicle_no: null, resident_count: 1, room_type_id: 1, move_in_date: "2026-01-01", move_out_date: null,
        status: "occupied", billing_enabled: true, print_enabled: true, late_fee_enabled: true, single_print: false,
        billing_note: null, settlement_note: null, facility_note: null, transfer_method: "giro",
        bill_name_display: "code", bill_delivery: "alimtalk", bill_auth: true, move_out_scheduled_date: "2026-08-31",
      },
      error: null,
    });
    const propertySingle = vi.fn().mockResolvedValue({
      data: {
        id: 5, unit_id: 3, property_name: "101호 매물", address: null, address_detail: null,
        property_type: "oneroom", deal_type: "direct", rent_type: "month", area_m2: 42.5,
        deposit: 1000000, jeonse_deposit: null, monthly_rent: 500000, mgmt_fee_desc: null,
        available_date: null, location: null, facilities: ["에어컨"],
      },
      error: null,
    });
    from.mockImplementation((table: string) => {
      if (table === "units") return { select: () => ({ eq: () => ({ is: () => ({ single: unitSingle }) }) }) };
      if (table === "unit_property_listings") {
        return { select: () => ({ eq: () => ({ is: () => ({ maybeSingle: propertySingle }) }) }) };
      }
      return { select: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: () => ({ maybeSingle: occupancySingle }) }) }) }) }) };
    });

    const result = await getUnitOccupancyFull(3);
    expect(rpc).toHaveBeenNthCalledWith(1, "execute_due_move_outs");
    expect(result.occupancy).toMatchObject({
      transferMethod: "giro", billNameDisplay: "code", billDelivery: "alimtalk", billAuth: true, faxNumber: "02-1234",
      moveOutScheduledDate: "2026-08-31",
    });
    expect(result.property).toMatchObject({ propertyName:"101호 매물", areaM2:42.5, facilities:["에어컨"] });
  });

  it("퇴실 실행·예약·취소 RPC에 확정 파라미터를 전달한다", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await executeMoveOut(9, "2026-08-18");
    await scheduleMoveOut(9, "2026-08-31");
    await cancelMoveOutSchedule(9);
    expect(rpc).toHaveBeenCalledWith("execute_move_out", { p_occupancy_id: 9, p_move_out_date: "2026-08-18" });
    expect(rpc).toHaveBeenCalledWith("schedule_move_out", { p_occupancy_id: 9, p_move_out_date: "2026-08-31" });
    expect(rpc).toHaveBeenCalledWith("cancel_move_out_schedule", { p_occupancy_id: 9 });
  });
});
