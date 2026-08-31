import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from, rpc }) }));
import { listBuildingTypes, createBuildingType, getBuildingTypeUsage, reorderBuildingTypes } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("buildingTypes apis", () => {
  it("listBuildingTypes: snake→camel 매핑", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, org_id:9, label:"아파트", sort_order:0 }], error:null });
    from.mockReturnValue({ select: () => ({ order }) });
    const r = await listBuildingTypes();
    expect(r[0]).toMatchObject({ id:1, orgId:9, label:"아파트", sortOrder:0 });
  });
  it("createBuildingType: org_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, label:"빌라", sort_order:1 }, error:null });
    const sel = vi.fn(() => ({ single })); const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createBuildingType({ orgId:9, label:"빌라", sortOrder:1 });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, label:"빌라", sort_order:1 }));
  });
  it("reorderBuildingTypes: ordered ids를 단일 RPC로 전송", async () => {
    rpc.mockResolvedValue({ error: null });
    await reorderBuildingTypes([3, 1, 2]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("reorder_building_types", { p_ordered_ids: [3, 1, 2] });
  });
  it("getBuildingTypeUsage: 건물 배정과 부과 이력을 함께 확인", async () => {
    const buildingLimit = vi.fn().mockResolvedValue({ data: [{ id: 4 }], error: null });
    const chargeLimit = vi.fn().mockResolvedValue({ data: [{ id: 8 }], error: null });
    from.mockImplementation((table: string) => ({
      select: () => table === "buildings"
        ? { eq: () => ({ limit: buildingLimit }) }
        : table === "fee_items"
          ? { eq: vi.fn().mockResolvedValue({ data: [{ id: 11 }], error: null }) }
          : { in: () => ({ limit: chargeLimit }) },
    }));

    await expect(getBuildingTypeUsage(3)).resolves.toEqual({ buildings: true, billing: true });
    expect(from).toHaveBeenCalledWith("fee_item_charges");
  });
});
