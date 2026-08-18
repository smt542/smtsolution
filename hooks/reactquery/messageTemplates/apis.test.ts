import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listMessageTemplates, createMessageTemplate, updateMessageTemplate, deleteMessageTemplate } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("messageTemplates apis", () => {
  it("list: deleted_at is null + snake→camel", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, org_id:9, title:"미납", body:"#{이름}님", sort_order:0 }], error:null });
    from.mockReturnValue({ select: () => ({ is: () => ({ order }) }) });
    const r = await listMessageTemplates();
    expect(r[0]).toEqual({ id:1, orgId:9, title:"미납", body:"#{이름}님", sortOrder:0 });
  });
  it("create: org_id·title·body insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, title:"공지", body:"b", sort_order:0 }, error:null });
    const ins = vi.fn(() => ({ select: () => ({ single }) }));
    from.mockReturnValue({ insert: ins });
    await createMessageTemplate({ orgId:9, title:"공지", body:"b" });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, title:"공지", body:"b" }));
  });
  it("update: 제공 필드만", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:1, org_id:9, title:"수정", body:"b", sort_order:0 }, error:null });
    const eq = vi.fn(() => ({ select: () => ({ single }) }));
    const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await updateMessageTemplate(1, { title:"수정" });
    expect(upd).toHaveBeenCalledWith({ title:"수정" });
  });
  it("delete: soft(deleted_at)", async () => {
    const eq = vi.fn().mockResolvedValue({ error:null });
    const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await deleteMessageTemplate(3);
    expect(upd).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("id", 3);
  });
});
