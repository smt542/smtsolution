import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ __admin: true }) }));
const reconcilePendingDeliveries = vi.fn();
vi.mock("@/lib/messaging/reconcile", () => ({
  reconcilePendingDeliveries: (...a: unknown[]) => reconcilePendingDeliveries(...a),
}));

import { POST } from "./route";

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/delivery/reconcile", { method: "POST", headers });
}

beforeEach(() => {
  process.env.CRON_SECRET = "s3cr3t";
  reconcilePendingDeliveries.mockResolvedValue({
    processed: 3,
    pending: 1,
    finalized: 1,
    reconcileRequired: 1,
  });
});
afterEach(() => {
  vi.clearAllMocks();
  delete process.env.CRON_SECRET;
});

describe("POST /api/delivery/reconcile", () => {
  it("시크릿 없으면 401, reconcile 미호출", async () => {
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(reconcilePendingDeliveries).not.toHaveBeenCalled();
  });

  it("잘못된 시크릿이면 401", async () => {
    const res = await POST(request({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(reconcilePendingDeliveries).not.toHaveBeenCalled();
  });

  it("유효 시크릿이면 재조회 실행·집계만 반환", async () => {
    const res = await POST(request({ authorization: "Bearer s3cr3t" }));
    expect(res.status).toBe(200);
    expect(reconcilePendingDeliveries).toHaveBeenCalled();
    expect(await res.json()).toEqual({
      processed: 3,
      pending: 1,
      finalized: 1,
      reconcileRequired: 1,
    });
  });
});
