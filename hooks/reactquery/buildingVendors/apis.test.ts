// hooks/reactquery/buildingVendors/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listBuildingVendorsByBuilding } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("buildingVendors apis", () => {
  it("listByBuilding: building_id + deleted_at null + snake→camel", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 7, building_id: 3, vendor_type: "elevator", name: "한국승강기", phone: "02-1", memo: null, sort_order: 0 }],
      error: null,
    });
    const is = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ is }));
    from.mockReturnValue({ select: () => ({ eq }) });

    const r = await listBuildingVendorsByBuilding(3);

    expect(from).toHaveBeenCalledWith("building_vendors");
    expect(eq).toHaveBeenCalledWith("building_id", 3);
    expect(r[0]).toEqual({ id: 7, buildingId: 3, vendorType: "elevator", name: "한국승강기", phone: "02-1", memo: null, sortOrder: 0 });
  });
});
