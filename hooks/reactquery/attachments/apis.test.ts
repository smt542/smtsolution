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
import { uploadAttachment, listAttachments, listAttachmentsByEntities } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("attachments apis", () => {
  it("upload: {org}/{entityType}/{entityId}/ 경로 + 행 insert", async () => {
    uploadMock.mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({
      data: { id: 10, org_id: 9, entity_type: "building_vendor", entity_id: 7, kind: "contract",
        file_url: "9/building_vendor/7/x.pdf", file_name: "x.pdf", created_at: "t" },
      error: null,
    });
    from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });

    const file = new File(["c"], "x.pdf", { type: "application/pdf" });
    const r = await uploadAttachment({ entityType: "building_vendor", entityId: 7, orgId: 9, kind: "contract", file });

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^9\/building_vendor\/7\//),
      file,
      { contentType: "application/pdf", upsert: false },
    );
    expect(r).toMatchObject({ id: 10, entityType: "building_vendor", entityId: 7, kind: "contract" });
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
