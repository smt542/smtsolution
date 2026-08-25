import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { mintNoticeShareToken, publicNoticeByToken } from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notice share-token APIs", () => {
  it("maps only the whitelisted public notice fields", async () => {
    rpc.mockResolvedValue({
      data: {
        title: "수도 점검 안내",
        content: "오전 10시부터 점검합니다.",
        notice_type: "important",
        building_name: "그린빌라",
        published_at: "2026-08-25T01:00:00Z",
        is_expired: false,
        tenant_name: "노출되면 안 됨",
      },
      error: null,
    });

    await expect(
      publicNoticeByToken("11111111-2222-4333-8444-555555555555"),
    ).resolves.toEqual({
      title: "수도 점검 안내",
      content: "오전 10시부터 점검합니다.",
      noticeType: "important",
      buildingName: "그린빌라",
      publishedAt: "2026-08-25T01:00:00Z",
      isExpired: false,
    });
    expect(rpc).toHaveBeenCalledWith("public_notice_by_token", {
      p_token: "11111111-2222-4333-8444-555555555555",
    });
  });

  it("returns null for an unknown token", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(publicNoticeByToken("missing")).resolves.toBeNull();
  });

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
