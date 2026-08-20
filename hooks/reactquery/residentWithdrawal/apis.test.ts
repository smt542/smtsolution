import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { residentWithdraw } from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("resident withdrawal API", () => {
  it("calls the resident_withdraw RPC with no arguments", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(residentWithdraw()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("resident_withdraw");
  });

  it("throws the RPC error message on failure", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "authentication required" },
    });

    await expect(residentWithdraw()).rejects.toThrow("authentication required");
  });
});
