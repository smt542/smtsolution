import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getPublicNoticeByToken } from "./data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("getPublicNoticeByToken", () => {
  it("maps only the whitelisted public notice fields", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        title: "수도 점검 안내",
        content: "오전 10시부터 점검합니다.",
        content_json: { type: "doc", content: [{ type: "paragraph" }] },
        notice_type: "important",
        building_name: "그린빌라",
        published_at: "2026-08-25T01:00:00Z",
        is_expired: false,
        tenant_name: "노출되면 안 됨",
      },
      error: null,
    });

    await expect(getPublicNoticeByToken("notice-token")).resolves.toEqual({
      notice: {
        title: "수도 점검 안내",
        content: "오전 10시부터 점검합니다.",
        contentJson: { type: "doc", content: [{ type: "paragraph" }] },
        noticeType: "important",
        buildingName: "그린빌라",
        publishedAt: "2026-08-25T01:00:00Z",
        isExpired: false,
      },
      // 본문에 이미지 노드가 없으면 service_role 조회 없이 빈 맵을 반환한다.
      imageUrls: {},
    });
    expect(mocks.rpc).toHaveBeenCalledWith("public_notice_by_token", {
      p_token: "notice-token",
    });
  });

  it("returns null notice for an unknown token and forwards RPC errors", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "failed" } });

    await expect(getPublicNoticeByToken("missing")).resolves.toEqual({
      notice: null,
      imageUrls: {},
    });
    await expect(getPublicNoticeByToken("failed")).rejects.toThrow("failed");
  });
});
