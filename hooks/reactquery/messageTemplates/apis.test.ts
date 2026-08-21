import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listMessageTemplates, createMessageTemplate, updateMessageTemplate, deleteMessageTemplate } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("messageTemplates apis", () => {
  it("list: deleted_at is null + snake→camel(신규 필드 포함)", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{
      id:1, org_id:9, title:"미납", body:"#{이름}님", sort_order:0,
      category:"독촉", channel_type:"alimtalk", alimtalk_template_code:"T1",
      buttons:[{ name:"확인", type:"WL", url:"https://x" }],
    }], error:null });
    from.mockReturnValue({ select: () => ({ is: () => ({ order }) }) });
    const r = await listMessageTemplates();
    expect(r[0]).toMatchObject({
      id:1, orgId:9, title:"미납", body:"#{이름}님", sortOrder:0,
      category:"독촉", channelType:"alimtalk", alimtalkTemplateCode:"T1",
    });
    expect(r[0].buttons[0]).toMatchObject({ name:"확인", type:"WL" });
  });
  it("list: 신규 필드 누락 시 기본값(channel_type='sms'·buttons=[])", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, org_id:9, title:"t", body:"b", sort_order:0 }], error:null });
    from.mockReturnValue({ select: () => ({ is: () => ({ order }) }) });
    const r = await listMessageTemplates();
    expect(r[0]).toMatchObject({ channelType:"sms", category:null, alimtalkTemplateCode:null });
    expect(r[0].buttons).toEqual([]);
  });
  it("create: 신규 필드 포함 insert(snake)", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, title:"공지", body:"b", sort_order:0, channel_type:"sms", buttons:[] }, error:null });
    const ins = vi.fn(() => ({ select: () => ({ single }) }));
    from.mockReturnValue({ insert: ins });
    await createMessageTemplate({ orgId:9, title:"공지", body:"b", channelType:"alimtalk", alimtalkTemplateCode:"T2", buttons:[{ name:"보기", type:"WL", url:"https://y" }] });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({
      org_id:9, title:"공지", body:"b", channel_type:"alimtalk", alimtalk_template_code:"T2",
    }));
    expect(ins.mock.calls[0][0].buttons[0]).toMatchObject({ name:"보기", type:"WL" });
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
