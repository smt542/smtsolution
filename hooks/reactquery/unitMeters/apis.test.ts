import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listMetersByUnit } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("unitMeters apis", () => {
  it("listByUnit: unit_id 필터 + snake→camel", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, unit_id:3, utility:"water", meter_no:"M1", customer_no:"C1" }], error:null });
    const eq = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: () => ({ eq }) });
    const r = await listMetersByUnit(3);
    expect(from).toHaveBeenCalledWith("unit_meters");
    expect(eq).toHaveBeenCalledWith("unit_id", 3);
    expect(r[0]).toEqual({ id:1, unitId:3, utility:"water", meterNo:"M1", customerNo:"C1" });
  });
});
