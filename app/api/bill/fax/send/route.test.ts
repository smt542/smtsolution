import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const serverRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc: serverRpc })),
}));
const adminRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: adminRpc }) }));
const isPopbillConfigured = vi.fn();
vi.mock("@/lib/popbill/config", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  isPopbillConfigured: () => isPopbillConfigured(),
}));
const loadFaxDocumentData = vi.fn();
vi.mock("@/lib/bill/faxData", () => ({ loadFaxDocumentData: (...a: unknown[]) => loadFaxDocumentData(...a) }));
const renderFaxPdf = vi.fn();
vi.mock("@/lib/bill/faxPdf", () => ({ renderFaxPdf: (...a: unknown[]) => renderFaxPdf(...a) }));
const submitFax = vi.fn();
vi.mock("@/lib/popbill/fax", () => ({ submitFax: (...a: unknown[]) => submitFax(...a) }));

import { POST } from "./route";
import { PopbillSubmitError } from "@/lib/popbill/types";

function req(body: unknown): Request {
  return new Request("http://x/api/bill/fax/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const doc = { faxNumber: "02-333-4444", householdName: "홍길동", building: { name: "그린빌라" } };

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
  serverRpc.mockImplementation((name: string) =>
    name === "get_my_context"
      ? Promise.resolve({ data: [{ org_id: 10, role: "org_owner", permissions: [] }], error: null })
      : Promise.resolve({ data: null, error: null }),
  );
  isPopbillConfigured.mockReturnValue(true);
  loadFaxDocumentData.mockResolvedValue(doc);
  renderFaxPdf.mockResolvedValue(Buffer.from("%PDF-1.7"));
  submitFax.mockResolvedValue({ requestNum: "f5a0", receiptNum: "FAX-1" });
  adminRpc.mockImplementation((name: string) => {
    if (name === "create_fax_dispatch_job") {
      return Promise.resolve({ data: { ok: true, job_id: 1, request_num: "f5a0", provider_ref_key: "f5a0" }, error: null });
    }
    return Promise.resolve({ data: { ok: true }, error: null });
  });
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/bill/fax/send", () => {
  it("미인증이면 401", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(req({ billIssueIds: [5] }))).status).toBe(401);
  });

  it("bill_publish 권한 없으면 403", async () => {
    serverRpc.mockImplementation(() =>
      Promise.resolve({ data: [{ org_id: 10, role: "staff", permissions: [] }], error: null }),
    );
    expect((await POST(req({ billIssueIds: [5] }))).status).toBe(403);
  });

  it("bill issue가 없으면 400", async () => {
    expect((await POST(req({ billIssueIds: [] }))).status).toBe(400);
  });

  it("설정 누락이면 503", async () => {
    isPopbillConfigured.mockReturnValue(false);
    const res = await POST(req({ billIssueIds: [5] }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("PROVIDER_NOT_CONFIGURED");
    expect(loadFaxDocumentData).not.toHaveBeenCalled();
  });

  it("세대별 PDF 접수 → 202 queued, mark accepted", async () => {
    const res = await POST(req({ billIssueIds: [5] }));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ queued: 1, failed: 0 });
    expect(renderFaxPdf).toHaveBeenCalledTimes(1);
    expect(submitFax).toHaveBeenCalledTimes(1);
    expect(adminRpc).toHaveBeenCalledWith(
      "mark_fax_dispatch_result",
      expect.objectContaining({ p_job_id: 1, p_outcome: "accepted", p_receipt_num: "FAX-1" }),
    );
  });

  it("팩스번호가 없으면 job을 만들지 않고 failed", async () => {
    loadFaxDocumentData.mockResolvedValue({ ...doc, faxNumber: null });
    const res = await POST(req({ billIssueIds: [5] }));
    expect(await res.json()).toMatchObject({ queued: 0, failed: 1 });
    expect(submitFax).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalledWith("create_fax_dispatch_job", expect.anything());
  });

  it("접수 확정 실패는 failed로 표기(mark failed)", async () => {
    submitFax.mockRejectedValue(new PopbillSubmitError("506", "발신번호 오류"));
    const res = await POST(req({ billIssueIds: [5] }));
    expect(await res.json()).toMatchObject({ queued: 0, failed: 1 });
    expect(adminRpc).toHaveBeenCalledWith(
      "mark_fax_dispatch_result",
      expect.objectContaining({ p_job_id: 1, p_outcome: "failed" }),
    );
  });
});
