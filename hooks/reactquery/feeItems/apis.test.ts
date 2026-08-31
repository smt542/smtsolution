import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from, rpc }) }));
import { listAllFeeItems, listFeeItems, createFeeItem, updateFeeItem, deleteFeeItem, reorderFeeItems } from "./apis";
beforeEach(() => vi.clearAllMocks());

function mockLookupQuery(data: unknown[] = []) {
  const query: {
    is: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
  } = {
    is: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  query.is.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockResolvedValue({ data, count: data.length, error: null });
  const select = vi.fn(() => query);
  from.mockReturnValue({ select });
  return { query, select };
}

describe("feeItems apis", () => {
  it("listFeeItems: snake→camel 매핑, 소프트삭제 제외", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id:1, org_id:9, type_id:3, name:"관리비", rounding:"round", daily_proration:true, carry_over:false, is_required:true, sort_order:0 }],
      error: null,
    });
    const is = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ is }));
    from.mockReturnValue({ select: () => ({ eq }) });
    const r = await listFeeItems(3);
    expect(eq).toHaveBeenCalledWith("type_id", 3);
    expect(is).toHaveBeenCalledWith("deleted_at", null);
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
  it("deleteFeeItem: 비필수는 소프트삭제(deleted_at 세팅)", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await deleteFeeItem({ id:2, isRequired:false });
    expect(upd).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("id", 2);
  });
  it("reorderFeeItems: ordered ids를 단일 RPC로 전송", async () => {
    rpc.mockResolvedValue({ error: null });
    await reorderFeeItems([4, 2, 3]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("reorder_fee_items", { p_ordered_ids: [4, 2, 3] });
  });
});

describe("listAllFeeItems", () => {
  it("applies deleted_at and ordering without optional filters", async () => {
    const { query, select } = mockLookupQuery();

    await listAllFeeItems({});

    expect(from).toHaveBeenCalledWith("fee_items");
    expect(select).toHaveBeenCalledWith(
      "id, type_id, name, rounding, daily_proration, carry_over, is_required, sort_order, building_types!inner(id, label)",
      { count: "exact" },
    );
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(query.eq).not.toHaveBeenCalled();
    expect(query.ilike).not.toHaveBeenCalled();
    expect(query.order.mock.calls).toEqual([["type_id"], ["sort_order"]]);
    expect(query.range).toHaveBeenCalledWith(0, 49);
  });

  it("applies the building-type filter", async () => {
    const { query } = mockLookupQuery();

    await listAllFeeItems({ typeId: 7 });

    expect(query.eq).toHaveBeenCalledWith("type_id", 7);
  });

  it.each([true, false])("applies the required=%s filter", async (required) => {
    const { query } = mockLookupQuery();

    await listAllFeeItems({ required });

    expect(query.eq).toHaveBeenCalledWith("is_required", required);
  });

  it.each([null, undefined])("does not filter is_required for %s", async (required) => {
    const { query } = mockLookupQuery();

    await listAllFeeItems({ required });

    expect(query.eq).not.toHaveBeenCalledWith("is_required", expect.anything());
  });

  it("trims q and applies the item-name ilike filter", async () => {
    const { query } = mockLookupQuery();

    await listAllFeeItems({ q: "  관리  " });

    expect(query.ilike).toHaveBeenCalledWith("name", "%관리%");
  });

  it.each(["", "   "])("does not apply ilike for an empty query", async (q) => {
    const { query } = mockLookupQuery();

    await listAllFeeItems({ q });

    expect(query.ilike).not.toHaveBeenCalled();
  });

  it("maps joined database rows to the lookup view model", async () => {
    mockLookupQuery([
      {
        id: 1,
        type_id: 7,
        name: "일반관리비",
        rounding: "round",
        daily_proration: false,
        carry_over: true,
        is_required: true,
        sort_order: 0,
        building_types: { label: "원룸텔" },
      },
      {
        id: 2,
        type_id: 8,
        name: "청소비",
        rounding: "raw",
        daily_proration: true,
        carry_over: false,
        is_required: false,
        sort_order: 1,
        building_types: null,
      },
    ]);

    const result = await listAllFeeItems({});

    expect(result).toEqual({
      rows: [{
        id: 1,
        typeId: 7,
        typeLabel: "원룸텔",
        name: "일반관리비",
        rounding: "round",
        dailyProration: false,
        carryOver: true,
        isRequired: true,
        sortOrder: 0,
      },
      {
        id: 2,
        typeId: 8,
        typeLabel: "",
        name: "청소비",
        rounding: "raw",
        dailyProration: true,
        carryOver: false,
        isRequired: false,
        sortOrder: 1,
      }],
      total: 2,
    });
  });
});
