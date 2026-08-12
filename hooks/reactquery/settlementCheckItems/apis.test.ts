import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listSettlementCheckItems, createSettlementCheckItem } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("settlementCheckItems apis", () => {
  it("list: settlement_check_items 테이블 조회 + deleted_at is null", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, org_id:9, label:"도배", sort_order:0 }], error:null });
    const is = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ is }));
    from.mockReturnValue({ select });
    const r = await listSettlementCheckItems();
    expect(from).toHaveBeenCalledWith("settlement_check_items");
    expect(r[0]).toEqual({ id:1, orgId:9, label:"도배", sortOrder:0 });
  });

  it("create: org_id·label insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, label:"청소", sort_order:0 }, error:null });
    const ins = vi.fn(() => ({ select: () => ({ single }) }));
    from.mockReturnValue({ insert: ins });
    await createSettlementCheckItem({ orgId:9, label:"청소" });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, label:"청소" }));
  });
});
