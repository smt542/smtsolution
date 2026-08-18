import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listHistoryByUnit } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("occupancyHistory apis", () => {
  it("listByUnit: unit_id + move_out_date desc + 매핑", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, unit_id:3, tenant_name:"김전출", phone:"010-1", phone2:"010-2", phone3:"02-3", move_in_date:"2025-01-01", move_out_date:"2026-01-01", room_type_label:"원룸" }], error:null });
    const eq = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: () => ({ eq }) });
    const r = await listHistoryByUnit(3);
    expect(eq).toHaveBeenCalledWith("unit_id", 3);
    expect(r[0]).toEqual({ id:1, unitId:3, tenantName:"김전출", phone:"010-1", phone2:"010-2", phone3:"02-3", moveInDate:"2025-01-01", moveOutDate:"2026-01-01", roomTypeLabel:"원룸" });
  });
});
