import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const serverRpc = vi.fn();
const serverFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc: serverRpc, from: serverFrom })),
}));
const adminRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: adminRpc }) }));
const dispatchMessages = vi.fn();
vi.mock("@/lib/messaging/dispatch", () => ({
  dispatchMessages: (...a: unknown[]) => dispatchMessages(...a),
}));

import { POST } from "./route";

const VALID_IDEM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function req(body: unknown, opts?: { idempotencyKey?: string | null }): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const key = opts && "idempotencyKey" in opts ? opts.idempotencyKey : VALID_IDEM;
  if (key != null) headers["idempotency-key"] = key;
  return new Request("http://x/api/messaging/send", {
    method: "POST",
    headers,
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
  serverRpc.mockImplementation((name: string) =>
    name === "current_user_is_manager_staff"
      ? Promise.resolve({ data: true, error: null })
      : name === "get_my_context"
      ? Promise.resolve({ data: [{ org_id: 10, role: "org_owner", permissions: [] }], error: null })
      : Promise.resolve({ data: null, error: null }),
  );
  dispatchMessages.mockResolvedValue({
    ok: true,
    status: "queued",
    logId: 9,
    reservationId: 5,
    queuedCount: 1,
    reservedPoints: 1,
  });
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/messaging/send", () => {
  it("미인증이면 401", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(req(payload));
    expect(res.status).toBe(401);
    expect(dispatchMessages).not.toHaveBeenCalled();
  });

  it("messaging 권한 없으면 403", async () => {
    serverRpc.mockImplementation((name: string) =>
      name === "current_user_is_manager_staff"
        ? Promise.resolve({ data: true, error: null })
        : name === "get_my_context"
        ? Promise.resolve({ data: [{ org_id: 10, role: "staff", permissions: [] }], error: null })
        : Promise.resolve({ data: null, error: null }),
    );
    const res = await POST(req(payload));
    expect(res.status).toBe(403);
    expect(dispatchMessages).not.toHaveBeenCalled();
  });

  it("Idempotency-Key 헤더가 없으면 400이고 dispatch를 호출하지 않는다", async () => {
    const res = await POST(req(payload, { idempotencyKey: null }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(dispatchMessages).not.toHaveBeenCalled();
  });

  it("Idempotency-Key가 UUID 형식이 아니면 400이고 dispatch를 호출하지 않는다", async () => {
    const res = await POST(req(payload, { idempotencyKey: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("IDEMPOTENCY_KEY_INVALID");
    expect(dispatchMessages).not.toHaveBeenCalled();
  });

  it("유효한 Idempotency-Key를 dispatchMessages input으로 전달한다", async () => {
    await POST(req(payload));
    expect(dispatchMessages).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: VALID_IDEM }),
      expect.anything(),
    );
  });

  it("접수 성공 → 202 queued", async () => {
    const res = await POST(req(payload));
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(json).toMatchObject({
      status: "queued",
      messageLogId: 9,
      reservationId: 5,
      queuedCount: 1,
      reservedPoints: 1,
    });
    // 접수만 되었으므로 sent/성공 확정 표기가 없어야 한다.
    expect(json.result).toBeUndefined();
    expect(json.sendResult).toBeUndefined();
  });

  it("설정 누락 → 503 PROVIDER_NOT_CONFIGURED", async () => {
    dispatchMessages.mockResolvedValue({
      ok: false,
      code: "PROVIDER_NOT_CONFIGURED",
      message: "발송 공급자가 설정되지 않았습니다.",
      httpStatus: 503,
    });
    const res = await POST(req(payload));
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.error).toBe("PROVIDER_NOT_CONFIGURED");
  });

  it("포인트 부족 → 402, 코드 전파", async () => {
    dispatchMessages.mockResolvedValue({
      ok: false,
      code: "INSUFFICIENT_POINTS",
      httpStatus: 402,
      detail: { required_points: 5, available_points: 0 },
    });
    const res = await POST(req(payload));
    const json = await res.json();
    expect(res.status).toBe(402);
    expect(json.error).toBe("INSUFFICIENT_POINTS");
    expect(json.required_points).toBe(5);
  });
});
