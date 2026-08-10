import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { makeLabelMasterApis } from "./labelMaster";
beforeEach(() => vi.clearAllMocks());

describe("makeLabelMasterApis", () => {
  it("list: deleted_at is null 필터 + sort_order 정렬 + snake→camel", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, org_id:9, label:"원룸", sort_order:0 }], error:null });
    const is = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: () => ({ is }) });
    const api = makeLabelMasterApis("room_types");
    const r = await api.list();
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(r[0]).toEqual({ id:1, orgId:9, label:"원룸", sortOrder:0 });
  });

  it("create: org_id·label insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, label:"투룸", sort_order:0 }, error:null });
    const sel = vi.fn(() => ({ single }));
    const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await makeLabelMasterApis("room_types").create({ orgId:9, label:"투룸" });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, label:"투룸" }));
  });

  it("softDelete: deleted_at 세팅 update(물리삭제 아님)", async () => {
    const eq = vi.fn().mockResolvedValue({ error:null });
    const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await makeLabelMasterApis("room_types").softDelete(5);
    expect(upd).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("id", 5);
  });
});
