import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const serverRpc = vi.fn();
const serverFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc: serverRpc, from: serverFrom })),
}));
const adminRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: adminRpc }) }));
const anyChannelConfigured = vi.fn();
const dispatchOne = vi.fn();
vi.mock("@/lib/messaging/dispatch", () => ({
  anyChannelConfigured: (...a: unknown[]) => anyChannelConfigured(...a),
  dispatchOne: (...a: unknown[]) => dispatchOne(...a),
}));

import { POST } from "./route";

function req(body: unknown): Request {
  return new Request("http://x/api/messaging/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const payload = {
  mode: "sms",
  body: "안녕하세요",
  context: "manual",
  templateId: null,
  recipients: [{ name: "홍", phone: "010-1111-2222", kind: "tenant" }],
};

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
  serverRpc.mockImplementation((name: string) => {
    if (name === "get_my_context") {
      return Promise.resolve({ data: [{ org_id: 10, role: "org_owner", permissions: [] }], error: null });
    }
    if (name === "quote_message_points") {
      return Promise.resolve({
        data: {
          ok: true,
          resolved_recipients: [{ phone: "010-1111-2222", channel: "sms" }],
          recipient_costs: [{ recipient_key: "key1", channel: "sms", rate_id: 1, points: 1 }],
          rate_ids: { sms: 1, alimtalk: 2 },
          estimated_points: 1,
          counts: { total: 1 },
        },
        error: null,
      });
    }
    if (name === "send_messages") {
      return Promise.resolve({ data: { log_id: 7, count: 1 }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  adminRpc.mockImplementation((name: string) => {
    if (name === "reserve_message_points") {
      return Promise.resolve({ data: { ok: true, reservation_id: 5, message_log_id: 9, status: "reserved", reserved_points: 1 }, error: null });
    }
    if (name === "settle_message_points") {
      return Promise.resolve({ data: { ok: true, status: "settled", result: "sent", charged_points: 1 }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  anyChannelConfigured.mockReturnValue(true);
  dispatchOne.mockResolvedValue({ status: "success", providerId: "p1" });
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/messaging/send", () => {
  it("미인증이면 401", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(req(payload));
    expect(res.status).toBe(401);
  });

  it("messaging 권한 없으면 403", async () => {
    serverRpc.mockImplementation((name: string) =>
      name === "get_my_context"
        ? Promise.resolve({ data: [{ org_id: 10, role: "staff", permissions: [] }], error: null })
        : Promise.resolve({ data: null, error: null }),
    );
    const res = await POST(req(payload));
    expect(res.status).toBe(403);
  });

  it("미설정이면 stub 경로(send_messages 호출·reserve 미호출)", async () => {
    anyChannelConfigured.mockReturnValue(false);
    const res = await POST(req(payload));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.billingMode).toBe("stub");
    expect(json.messageLogId).toBe(7);
    expect(serverRpc).toHaveBeenCalledWith("send_messages", expect.objectContaining({ p_channel: "sms" }));
    expect(adminRpc).not.toHaveBeenCalled();
    expect(dispatchOne).not.toHaveBeenCalled();
  });

  it("설정+충분 → quote→reserve→dispatch→settle, live 결과", async () => {
    const res = await POST(req(payload));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.billingMode).toBe("live");
    expect(json.result).toBe("sent");
    expect(json.chargedPoints).toBe(1);
    expect(dispatchOne).toHaveBeenCalledWith(expect.objectContaining({ channel: "sms", phone: "010-1111-2222", body: "안녕하세요" }));
    // settle는 quote recipient_costs의 recipient_key로 결과 전달
    expect(adminRpc).toHaveBeenCalledWith("settle_message_points", expect.objectContaining({
      p_reservation_id: 5,
      p_results: [{ recipient_key: "key1", status: "success" }],
    }));
  });

  it("reserve INSUFFICIENT_POINTS → 402, dispatch/settle 미호출", async () => {
    adminRpc.mockImplementation((name: string) =>
      name === "reserve_message_points"
        ? Promise.resolve({ data: { ok: false, code: "INSUFFICIENT_POINTS", required_points: 5, available_points: 0 }, error: null })
        : Promise.resolve({ data: null, error: null }),
    );
    const res = await POST(req(payload));
    const json = await res.json();
    expect(res.status).toBe(402);
    expect(json.error).toBe("INSUFFICIENT_POINTS");
    expect(dispatchOne).not.toHaveBeenCalled();
  });

  it("부분 실패 → settle에 success/failed 혼합 전달", async () => {
    serverRpc.mockImplementation((name: string) => {
      if (name === "get_my_context") return Promise.resolve({ data: [{ org_id: 10, role: "org_owner", permissions: [] }], error: null });
      if (name === "quote_message_points") return Promise.resolve({ data: {
        ok: true,
        resolved_recipients: [{ phone: "010-1111-2222", channel: "sms" }, { phone: "010-3333-4444", channel: "sms" }],
        recipient_costs: [{ recipient_key: "k1", channel: "sms" }, { recipient_key: "k2", channel: "sms" }],
        rate_ids: { sms: 1, alimtalk: 2 }, estimated_points: 2, counts: { total: 2 },
      }, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    dispatchOne
      .mockResolvedValueOnce({ status: "success", providerId: "p1" })
      .mockResolvedValueOnce({ status: "failed", reason: "sms_400" });
    await POST(req(payload));
    expect(adminRpc).toHaveBeenCalledWith("settle_message_points", expect.objectContaining({
      p_results: [{ recipient_key: "k1", status: "success" }, { recipient_key: "k2", status: "failed" }],
    }));
  });
});
