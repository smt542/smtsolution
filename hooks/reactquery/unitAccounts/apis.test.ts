import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listAccountsByUnit } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("unitAccounts apis", () => {
  it("listByUnit: unit_id 필터 + cms 매핑", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:2, unit_id:3, kind:"mgmt", bank:"국민", account:"111", holder:"홍", cms_member_no:"CMS1" }], error:null });
    const eq = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: () => ({ eq }) });
    const r = await listAccountsByUnit(3);
    expect(from).toHaveBeenCalledWith("unit_accounts");
    expect(r[0]).toEqual({ id:2, unitId:3, kind:"mgmt", bank:"국민", account:"111", holder:"홍", cmsMemberNo:"CMS1" });
  });
});
