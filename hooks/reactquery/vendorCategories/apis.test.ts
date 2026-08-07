import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listVendorCategories, createVendorCategory } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("vendorCategories apis", () => {
  it("listVendorCategories: snake→camel 매핑", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, org_id:9, label:"전기", sort_order:0 }], error:null });
    from.mockReturnValue({ select: () => ({ order }) });
    const r = await listVendorCategories();
    expect(r[0]).toMatchObject({ id:1, orgId:9, label:"전기", sortOrder:0 });
  });
  it("createVendorCategory: org_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, label:"배관", sort_order:1 }, error:null });
    const sel = vi.fn(() => ({ single })); const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createVendorCategory({ orgId:9, label:"배관", sortOrder:1 });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, label:"배관", sort_order:1 }));
  });
});
