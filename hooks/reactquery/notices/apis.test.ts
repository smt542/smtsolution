import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

import { createNotice, deleteNotice, getNotice, listNotices, updateNotice } from "./apis";

const row = {
  id: 3,
  org_id: 9,
  building_id: null,
  notice_buildings: [{ building_id: 11 }],
  title: "정기 소독 안내",
  content: "오전 10시에 소독합니다.",
  notice_type: "important",
  published_at: "2026-08-12T01:00:00.000Z",
  expires_at: null,
  created_by: null,
  created_at: "2026-08-11T01:00:00.000Z",
  updated_at: "2026-08-11T01:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());

function listBuilder(result = { data: [row], error: null, count: 1 }) {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };
  for (const method of ["select", "is", "eq", "gt", "lte", "or", "order", "range"]) {
    builder[method] = vi.fn(() => builder);
  }
  return builder as Record<"select" | "is" | "eq" | "gt" | "lte" | "or" | "order" | "range", ReturnType<typeof vi.fn>>;
}

describe("notices apis", () => {
  it("listNotices: soft delete 제외, 필터 적용, 대상 건물 임베드 매핑", async () => {
    const builder = listBuilder();
    from.mockReturnValue(builder);

    const result = await listNotices({ noticeType: "important", search: "소독" });

    expect(from).toHaveBeenCalledWith("notices");
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builder.eq).toHaveBeenCalledWith("notice_type", "important");
    expect(builder.or).toHaveBeenCalledWith("title.ilike.%소독%,content.ilike.%소독%");
    expect(builder.select).toHaveBeenCalledWith(
      "id, org_id, title, notice_type, published_at, expires_at, created_by, created_at, updated_at, notice_buildings(building_id)",
      { count: "exact" },
    );
    expect(builder.range).toHaveBeenCalledWith(0, 19);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 3,
      orgId: 9,
      buildingIds: [11],
      title: "정기 소독 안내",
      noticeType: "important",
    });
    expect(result.items[0]).not.toHaveProperty("content");
  });

  it("getNotice: 선택한 공지의 본문을 별도 조회", async () => {
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const activeOnly = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ is: activeOnly }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });

    await expect(getNotice(3)).resolves.toMatchObject({
      id: 3,
      content: "오전 10시에 소독합니다.",
    });
    expect(eq).toHaveBeenCalledWith("id", 3);
  });

  it("createNotice: 공지 삽입 후 대상 건물 링크를 upsert/정리", async () => {
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const deleteNot = vi.fn().mockResolvedValue({ error: null });
    const deleteEq = vi.fn(() => ({ not: deleteNot }));
    const del = vi.fn(() => ({ eq: deleteEq }));
    from.mockImplementation((table: string) =>
      table === "notices" ? { insert } : { upsert, delete: del },
    );

    await createNotice({
      orgId: 9,
      buildingIds: [11],
      title: "정기 소독 안내",
      content: "오전 10시에 소독합니다.",
      noticeType: "important",
      publishedAt: "2026-08-12T01:00:00.000Z",
      expiresAt: null,
    });

    // building_id 컬럼은 더 이상 쓰지 않는다(레거시).
    expect(insert).toHaveBeenCalledWith({
      org_id: 9,
      title: "정기 소독 안내",
      content: "오전 10시에 소독합니다.",
      notice_type: "important",
      published_at: "2026-08-12T01:00:00.000Z",
      expires_at: null,
    });
    expect(upsert).toHaveBeenCalledWith(
      [{ notice_id: 3, building_id: 11 }],
      { onConflict: "notice_id,building_id", ignoreDuplicates: true },
    );
    expect(deleteEq).toHaveBeenCalledWith("notice_id", 3);
    expect(deleteNot).toHaveBeenCalledWith("building_id", "in", "(11)");
  });

  it("updateNotice: 제공된 필드만 갱신", async () => {
    const single = vi.fn().mockResolvedValue({ data: { ...row, title: "변경" }, error: null });
    const select = vi.fn(() => ({ single }));
    const activeOnly = vi.fn(() => ({ select }));
    const eq = vi.fn(() => ({ is: activeOnly }));
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await updateNotice(3, { title: "변경" });

    expect(update).toHaveBeenCalledWith({ title: "변경" });
    expect(eq).toHaveBeenCalledWith("id", 3);
    expect(activeOnly).toHaveBeenCalledWith("deleted_at", null);
  });

  it("deleteNotice: delete 대신 deleted_at을 갱신", async () => {
    const activeOnly = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn(() => ({ is: activeOnly }));
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await deleteNotice(3);

    expect(update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith("id", 3);
    expect(activeOnly).toHaveBeenCalledWith("deleted_at", null);
  });
});
