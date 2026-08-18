import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
import { sendMessages, listTenantAlimtalkConsent } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("messaging apis (P4b)", () => {
  it("sendMessages: rpc send_messages 5-arg(mode·template·recipients)", async () => {
    rpc.mockResolvedValue({ data: { log_id: 7, count: 2 }, error: null });
    const out = await sendMessages({
      mode: "auto", body: "#{이름}님", context: "manual", templateId: 5,
      recipients: [
        { name: "A", phone: "0101", kind: "tenant", channel: "alimtalk", renderedBody: "A님", ref: { occupancyId: 11 } },
        { name: "B", phone: "0102", kind: "owner", channel: "sms", renderedBody: "B님" },
      ],
    });
    expect(out).toEqual({ logId: 7, count: 2 });
    expect(rpc).toHaveBeenCalledWith("send_messages", expect.objectContaining({
      p_channel: "auto", p_body: "#{이름}님", p_context: "manual", p_template_id: 5,
      p_recipients: expect.any(Array),
    }));
  });
  it("listTenantAlimtalkConsent: rpc·snake→camel", async () => {
    rpc.mockResolvedValue({ data: [{ occupancy_id: 11, alimtalk_opt_in: true, sms_opt_in: false }], error: null });
    const r = await listTenantAlimtalkConsent(3);
    expect(rpc).toHaveBeenCalledWith("list_tenant_alimtalk_consent", { p_building_id: 3 });
    expect(r[0]).toEqual({ occupancyId: 11, alimtalkOptIn: true, smsOptIn: false });
  });
  it("sendMessages: rpc 에러 전파", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    await expect(sendMessages({ mode: "sms", body: "x", context: "manual", templateId: null, recipients: [{ name:"A", phone:"1", kind:"tenant", channel:"sms", renderedBody:"x" }] }))
      .rejects.toThrow("forbidden");
  });
});
