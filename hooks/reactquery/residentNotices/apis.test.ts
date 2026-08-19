import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { residentNoticeDetail, residentNotices } from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("resident notice APIs", () => {
  it("maps list and detail rows and passes the exact detail argument", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{
          id: 11,
          title: "승강기 점검 안내",
          notice_type: "important",
          building_id: 3,
          building_name: "해오름빌라",
          published_at: "2026-08-19T01:00:00Z",
          created_at: "2026-08-18T01:00:00Z",
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 11,
          title: "승강기 점검 안내",
          content: "오전 10시부터 점검합니다.",
          notice_type: "important",
          building_id: 3,
          building_name: "해오름빌라",
          published_at: "2026-08-19T01:00:00Z",
          created_at: "2026-08-18T01:00:00Z",
        }],
        error: null,
      });

    await expect(residentNotices()).resolves.toEqual([expect.objectContaining({
      id: 11,
      noticeType: "important",
      buildingId: 3,
      publishedAt: "2026-08-19T01:00:00Z",
    })]);
    await expect(residentNoticeDetail(11)).resolves.toEqual(expect.objectContaining({
      id: 11,
      content: "오전 10시부터 점검합니다.",
      buildingName: "해오름빌라",
    }));
    expect(rpc).toHaveBeenNthCalledWith(1, "resident_notices");
    expect(rpc).toHaveBeenNthCalledWith(2, "resident_notice_detail", { p_id: 11 });
  });

  it("returns null for a missing detail and propagates errors", async () => {
    rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "notice failed" } });

    await expect(residentNoticeDetail(99)).resolves.toBeNull();
    await expect(residentNotices()).rejects.toThrow("notice failed");
  });
});
