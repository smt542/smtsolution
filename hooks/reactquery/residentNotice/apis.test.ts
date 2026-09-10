import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { mintNoticeShareToken } from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notice share-token APIs", () => {
  it("mints a staff notice token and forwards RPC errors", async () => {
    rpc
      .mockResolvedValueOnce({
        data: "11111111-2222-4333-8444-555555555555",
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });

    await expect(mintNoticeShareToken(41)).resolves.toBe(
      "11111111-2222-4333-8444-555555555555",
    );
    expect(rpc).toHaveBeenCalledWith("mint_notice_share_token", {
      p_notice_id: 41,
    });
    await expect(mintNoticeShareToken(42)).rejects.toThrow("forbidden");
  });
});
