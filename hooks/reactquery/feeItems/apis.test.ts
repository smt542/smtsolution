import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listFeeItems, createFeeItem, updateFeeItem, deleteFeeItem } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("feeItems apis", () => {
  it("listFeeItems: snake→camel 매핑", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id:1, org_id:9, type_id:3, name:"관리비", rounding:"round", daily_proration:true, carry_over:false, is_required:true, sort_order:0 }],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: () => ({ eq }) });
    const r = await listFeeItems(3);
    expect(r[0]).toMatchObject({ id:1, orgId:9, typeId:3, name:"관리비", rounding:"round", dailyProration:true, carryOver:false, isRequired:true, sortOrder:0 });
  });
  it("createFeeItem: org_id, type_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, type_id:3, name:"전기세", rounding:"none", daily_proration:false, carry_over:false, is_required:false, sort_order:1 }, error:null });
    const sel = vi.fn(() => ({ single })); const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createFeeItem({ orgId:9, typeId:3, name:"전기세", rounding:"none", dailyProration:false, carryOver:false, isRequired:false, sortOrder:1 });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, type_id:3, name:"전기세" }));
  });
  it("updateFeeItem: 부분 업데이트는 제공된 필드만 전송", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:1, org_id:9, type_id:3, name:"수정관리비", rounding:"round", daily_proration:true, carry_over:false, is_required:true, sort_order:0 }, error:null });
    const sel = vi.fn(() => ({ single })); const eq = vi.fn(() => ({ select: sel })); const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await updateFeeItem(1, { name:"수정관리비" });
    expect(upd).toHaveBeenCalledWith({ name:"수정관리비" });
  });
  it("deleteFeeItem: 필수 항목 삭제 거부", async () => {
    await expect(deleteFeeItem({ id:1, isRequired:true })).rejects.toThrow("필수 항목은 삭제할 수 없습니다");
  });
});
