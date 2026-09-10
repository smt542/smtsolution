import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import {
  getResidentNoticeDetailPageData,
  getResidentNotices,
} from "./data";

const noticeRow = {
  id: 12,
  title: "승강기 점검 안내",
  notice_type: "important",
  building_id: 7,
  building_name: "해오름빌라",
  published_at: "2026-08-19T00:00:00Z",
  created_at: "2026-08-18T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("resident notice server data", () => {
  it("maps the resident notice list returned by the server RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: [noticeRow], error: null });

    await expect(getResidentNotices()).resolves.toEqual([
      {
        id: 12,
        title: "승강기 점검 안내",
        noticeType: "important",
        buildingId: 7,
        buildingName: "해오름빌라",
        publishedAt: "2026-08-19T00:00:00Z",
        createdAt: "2026-08-18T00:00:00Z",
      },
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("resident_notices");
  });

  it("loads detail and linked-building fallback in parallel", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [{ ...noticeRow, building_name: null, content: "점검합니다." }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ building_name: "해오름빌라", tenant_name: "노출하지 않음" }],
        error: null,
      });

    await expect(getResidentNoticeDetailPageData(12)).resolves.toEqual({
      detail: {
        id: 12,
        title: "승강기 점검 안내",
        content: "점검합니다.",
        noticeType: "important",
        buildingId: 7,
        buildingName: null,
        publishedAt: "2026-08-19T00:00:00Z",
        createdAt: "2026-08-18T00:00:00Z",
      },
      residentBuildingName: "해오름빌라",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "resident_notice_detail", {
      p_id: 12,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "resident_my_link");
  });

  it("returns missing detail and forwards RPC errors", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ building_name: "해오름빌라" }],
        error: null,
      });

    await expect(getResidentNoticeDetailPageData(99)).resolves.toEqual({
      detail: null,
      residentBuildingName: "해오름빌라",
    });

    mocks.rpc.mockResolvedValue({ data: null, error: { message: "failed" } });
    await expect(getResidentNotices()).rejects.toThrow("failed");
  });
});
