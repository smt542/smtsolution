import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadMock = vi.fn();
const createSignedUrlMock = vi.fn();
const removeMock = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from,
    storage: {
      from: () => ({
        upload: uploadMock,
        createSignedUrl: createSignedUrlMock,
        remove: removeMock,
      }),
    },
  }),
}));

import {
  listVendors,
  createVendor,
  updateVendor,
  uploadVendorAttachment,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("vendors apis", () => {
  it("listVendors: snake→camel 매핑", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id:1, org_id:9, name:"홍길동전기", phone:"010-1234-5678", bank_account:"국민123", memo:"메모", category_id:2 }],
      error: null,
    });
    from.mockReturnValue({ select: () => ({ order }) });
    const r = await listVendors();
    expect(r[0]).toMatchObject({ id:1, orgId:9, name:"홍길동전기", phone:"010-1234-5678", bankAccount:"국민123", memo:"메모", categoryId:2 });
  });

  it("createVendor: org_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:3, org_id:9, name:"ABC", phone:null, bank_account:null, memo:null, category_id:1 }, error:null });
    const sel = vi.fn(() => ({ single }));
    const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createVendor({ orgId:9, name:"ABC", categoryId:1 });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, name:"ABC", category_id:1 }));
  });

  it("updateVendor: 부분 업데이트는 제공된 필드만 전송", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:1, org_id:9, name:"새이름", phone:null, bank_account:null, memo:null, category_id:1 }, error:null });
    const sel = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select: sel }));
    const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await updateVendor(1, { name:"새이름" });
    expect(upd).toHaveBeenCalledWith({ name:"새이름" });
  });

  it("uploadVendorAttachment: org 경로로 업로드 후 attachments insert", async () => {
    const vendorId = 42;
    const orgId = 9;
    const file = new File(["content"], "contract.pdf", { type: "application/pdf" });

    uploadMock.mockResolvedValue({ data: { path: "9/vendor/42/uuid-contract.pdf" }, error: null });

    const insertedRow = { id:10, org_id:9, entity_type:"vendor", entity_id:42, kind:"contract", file_url:"9/vendor/42/uuid-contract.pdf", file_name:"contract.pdf", created_at:"2026-08-07T00:00:00Z" };
    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null });
    const sel = vi.fn(() => ({ single }));
    const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });

    const result = await uploadVendorAttachment({ vendorId, orgId, file });

    // Assert storage.upload was called with a path starting orgId/vendor/vendorId/
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${orgId}/vendor/${vendorId}/`)),
      file
    );

    // Assert attachments table insert with correct entity fields
    expect(ins).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: "vendor", entity_id: vendorId, org_id: orgId })
    );

    expect(result).toMatchObject({ orgId:9, entityType:"vendor", entityId:42, kind:"contract" });
  });

  it("uploadVendorAttachment: insert 실패 시 storage 객체 삭제(보상) 후 throw", async () => {
    const vendorId = 42;
    const orgId = 9;
    const file = new File(["content"], "contract.pdf", { type: "application/pdf" });

    uploadMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ error: null });

    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const sel = vi.fn(() => ({ single }));
    const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });

    await expect(uploadVendorAttachment({ vendorId, orgId, file })).rejects.toThrow("boom");

    expect(removeMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringMatching(new RegExp(`^${orgId}/vendor/${vendorId}/`))])
    );
  });
});
