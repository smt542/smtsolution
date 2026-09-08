import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const serverRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc: serverRpc }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ __admin: true }),
}));

const drainSchedules = vi.fn();
vi.mock("@/lib/messaging/drainSchedules", () => ({
  drainSchedules: (...args: unknown[]) => drainSchedules(...args),
}));

import { POST } from "@/app/api/messaging/dispatch-scheduled/route";

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/messaging/dispatch-scheduled", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = "s3cr3t";
  drainSchedules.mockResolvedValue({
    claimed: 2,
    queued: 1,
    failed: 1,
    unconfigured: 0,
    finalized: 0,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.CRON_SECRET;
});

describe("POST /api/messaging/dispatch-scheduled", () => {
  it("시크릿·세션 모두 없으면 401", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(drainSchedules).not.toHaveBeenCalled();
  });

  it("유효 시크릿이면 전 org(orgId=null) 드레인", async () => {
    const response = await POST(request({ authorization: "Bearer s3cr3t" }));

    expect(response.status).toBe(200);
    expect(drainSchedules).toHaveBeenCalledWith(expect.objectContaining({ orgId: null }));
    expect(getUser).not.toHaveBeenCalled();
  });

  it("세션(messaging 권한)이면 본인 org 드레인", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serverRpc.mockImplementation((name: string) =>
      name === "current_user_is_manager_staff"
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({
          data: [{ org_id: 7, role: "staff", permissions: ["messaging"] }],
          error: null,
        }),
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(drainSchedules).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7 }));
  });

  it("세션 있으나 messaging 권한 없으면 403", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serverRpc.mockImplementation((name: string) =>
      name === "current_user_is_manager_staff"
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({
          data: [{ org_id: 7, role: "staff", permissions: [] }],
          error: null,
        }),
    );

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(drainSchedules).not.toHaveBeenCalled();
  });

  it("집계 JSON 반환", async () => {
    const response = await POST(request({ authorization: "Bearer s3cr3t" }));

    expect(await response.json()).toMatchObject({ claimed: 2, queued: 1, failed: 1 });
  });
});
