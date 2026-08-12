import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { getUnit } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("units apis", () => {
  it("getUnit: id로 조회, snake→camel 매핑", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id:1, building_id:10, unit_no:"101", dong:"A동", area_pyeong:25.5, room_count:2, memo:"메모" },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    from.mockReturnValue({ select: () => ({ eq }) });
    const r = await getUnit(1);
    expect(eq).toHaveBeenCalledWith("id", 1);
    expect(r).toMatchObject({ id:1, buildingId:10, unitNo:"101", dong:"A동", areaPyeong:25.5, roomCount:2, memo:"메모" });
  });
});
