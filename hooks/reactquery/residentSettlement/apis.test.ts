import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { mintSettlementShareToken } from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("settlement share-token APIs", () => {
  it("mints a staff settlement token and forwards RPC errors", async () => {
    rpc
      .mockResolvedValueOnce({
        data: "66666666-7777-4888-8999-000000000000",
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });

    await expect(mintSettlementShareToken(73)).resolves.toBe(
      "66666666-7777-4888-8999-000000000000",
    );
    expect(rpc).toHaveBeenCalledWith("mint_settlement_share_token", {
      p_settlement_id: 73,
    });
    await expect(mintSettlementShareToken(74)).rejects.toThrow("forbidden");
  });
});
