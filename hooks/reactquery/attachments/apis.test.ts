// hooks/reactquery/attachments/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlMock = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from,
    storage: { from: () => ({ upload: uploadMock, remove: removeMock, createSignedUrl: createSignedUrlMock }) },
  }),
}));
import {
  uploadAttachment,
  uploadAttachments,
  deleteAttachment,
  AttachmentConsistencyError,
  listAttachments,
  listAttachmentsByEntities,
} from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("attachments apis", () => {
  it("upload: {org}/{entityType}/{entityId}/ 경로 + 행 insert", async () => {
    uploadMock.mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({
      data: { id: 10, org_id: 9, entity_type: "building_vendor", entity_id: 7, kind: "contract",
        file_url: "9/building_vendor/7/x.pdf", file_name: "x.pdf", created_at: "t" },
      error: null,
    });
    const insert = vi.fn(() => ({ select: () => ({ single }) }));
    from.mockReturnValue({ insert });

    const file = new File(["c"], "x.pdf", { type: "application/pdf" });
    const r = await uploadAttachment({ entityType: "building_vendor", entityId: 7, orgId: 9, kind: "contract", file });

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^9\/building_vendor\/7\//),
      file,
      { contentType: "application/pdf", upsert: false },
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      mime_type: "application/pdf",
      size_bytes: file.size,
    }));
    expect(r).toMatchObject({ id: 10, entityType: "building_vendor", entityId: 7, kind: "contract" });
  });

  it("여러 파일 중 실패한 파일만 구분해 반환한다", async () => {
    uploadMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "storage failed" } });
    const single = vi.fn().mockResolvedValue({
      data: { id: 10, org_id: 9, entity_type: "vendor", entity_id: 7, kind: "contract", file_url: "ok", file_name: "ok.png", mime_type: "image/png", size_bytes: 1, created_at: "t" },
      error: null,
    });
    from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });
    const ok = new File(["1"], "ok.png", { type: "image/png" });
    const failed = new File(["2"], "failed.png", { type: "image/png" });

    const result = await uploadAttachments({
      entityType: "vendor",
      entityId: 7,
      orgId: 9,
      kind: "contract",
      fileType: "image",
      files: [ok, failed],
    });

    expect(result.succeeded.map(({ file }) => file)).toEqual([ok]);
    expect(result.failed.map(({ file }) => file)).toEqual([failed]);
  });

  it("DB insert 실패 시 업로드한 object를 보상 삭제한다", async () => {
    uploadMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "insert failed" } });
    from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });
    const file = new File(["1"], "photo.webp", { type: "image/webp" });

    await expect(uploadAttachment({
      entityType: "vendor",
      entityId: 7,
      orgId: 9,
      kind: "contract",
      fileType: "image",
      file,
    })).rejects.toThrow("insert failed");
    expect(removeMock).toHaveBeenCalledWith([
      expect.stringMatching(/^9\/vendor\/7\//),
    ]);
  });

  it("Storage 삭제 후 DB row 삭제가 반복 실패하면 복구 가능한 오류 정보를 남긴다", async () => {
    removeMock.mockResolvedValue({ error: null });
    const eq = vi.fn()
      .mockResolvedValueOnce({ error: { message: "first" } })
      .mockResolvedValueOnce({ error: { message: "second" } });
    from.mockReturnValue({ delete: () => ({ eq }) });

    const result = deleteAttachment({ id: 12, path: "9/vendor/7/photo.png" });
    await expect(result).rejects.toBeInstanceOf(AttachmentConsistencyError);
    await expect(result).rejects.toMatchObject({
      orphanedResource: "database_row",
      attachmentId: 12,
      path: "9/vendor/7/photo.png",
    });
    expect(eq).toHaveBeenCalledTimes(2);
  });

  it("listAttachments: entity_type·entity_id 필터", async () => {
    const eq2 = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    from.mockReturnValue({ select: () => ({ eq: eq1 }) });
    await listAttachments("building_vendor", 7);
    expect(eq1).toHaveBeenCalledWith("entity_type", "building_vendor");
    expect(eq2).toHaveBeenCalledWith("entity_id", 7);
  });

  it("listAttachmentsByEntities: 원장 여러 행을 한 번에 조회", async () => {
    const inFilter = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn(() => ({ in: inFilter }));
    from.mockReturnValue({ select: () => ({ eq }) });

    await listAttachmentsByEntities("long_term_repair_ledger", [7, 9]);

    expect(eq).toHaveBeenCalledWith("entity_type", "long_term_repair_ledger");
    expect(inFilter).toHaveBeenCalledWith("entity_id", [7, 9]);
  });
});
