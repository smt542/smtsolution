import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listUnits, createUnit, updateUnit } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("units apis", () => {
  it("listUnits: building_id로 필터, snake→camel 매핑", async () => {
    const resolve = vi.fn().mockResolvedValue({ data: [{ id:1, building_id:10, unit_no:"101", dong:"A동", area_pyeong:"25.50", room_count:2, elec_customer_no:"E001", elec_meter_no:"M001", water_customer_no:"W001", memo:"메모" }], error:null });
    const eq = vi.fn(() => ({ order: resolve }));
    from.mockReturnValue({ select: () => ({ eq }) });
    const r = await listUnits(10);
    expect(eq).toHaveBeenCalledWith("building_id", 10);
    expect(r[0]).toMatchObject({ id:1, buildingId:10, unitNo:"101", dong:"A동", areaPyeong:25.5, roomCount:2, elecCustomerNo:"E001", elecMeterNo:"M001", waterCustomerNo:"W001", memo:"메모" });
  });
  it("createUnit: building_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, building_id:10, unit_no:"102" }, error:null });
    const sel = vi.fn(() => ({ single })); const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createUnit({ buildingId:10, unitNo:"102" });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ building_id:10, unit_no:"102" }));
  });
  it("updateUnit: 부분 업데이트는 제공된 필드만 전송", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:1, building_id:10, unit_no:"101" }, error:null });
    const sel = vi.fn(() => ({ single })); const eq = vi.fn(() => ({ select: sel })); const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await updateUnit(1, { unitNo:"101동" });
    expect(upd).toHaveBeenCalledWith({ unit_no:"101동" });
  });
});
