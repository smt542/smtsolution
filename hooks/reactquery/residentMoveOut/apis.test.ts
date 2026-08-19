import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import {
  residentCancelMoveOut,
  residentCreateMoveOut,
  residentGetMoveOut,
  residentUpdateMoveOut,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("resident move-out APIs", () => {
  it("passes exact create/update/cancel RPC arguments", async () => {
    rpc
      .mockResolvedValueOnce({ data: 31, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(residentCreateMoveOut("2026-09-30", "이사")).resolves.toBe(31);
    await residentUpdateMoveOut("2026-10-05");
    await residentCancelMoveOut();

    expect(rpc).toHaveBeenNthCalledWith(1, "resident_create_move_out", {
      p_desired_date: "2026-09-30",
      p_reason: "이사",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "resident_update_move_out", {
      p_desired_date: "2026-10-05",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "resident_cancel_move_out");
  });

  it("maps the latest move-out row and handles no request", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{
          id: 31,
          desired_date: "2026-09-30",
          reason: "이사",
          status: "pending",
          created_at: "2026-08-19T01:00:00Z",
          updated_at: "2026-08-19T01:00:00Z",
          canceled_at: null,
          resolved_at: null,
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(residentGetMoveOut()).resolves.toEqual({
      id: 31,
      desiredDate: "2026-09-30",
      reason: "이사",
      status: "pending",
      createdAt: "2026-08-19T01:00:00Z",
      updatedAt: "2026-08-19T01:00:00Z",
      canceledAt: null,
      resolvedAt: null,
    });
    await expect(residentGetMoveOut()).resolves.toBeNull();
    expect(rpc).toHaveBeenNthCalledWith(1, "resident_get_move_out");
  });
});
