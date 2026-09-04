import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const serverRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc: serverRpc })),
}));
const adminRpc = vi.fn();
const setupMaybeSingle = vi.fn();
const adminFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({ maybeSingle: setupMaybeSingle })),
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: adminRpc, from: adminFrom }),
}));
const isPopbillConfigured = vi.fn();
vi.mock("@/lib/popbill/config", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  isPopbillConfigured: () => isPopbillConfigured(),
  readPopbillConfig: () => ({
    linkId: "test-link",
    secretKey: "test-secret",
    corpNum: "1234567890",
    userId: "test-user",
    isTest: true,
    ipRestrictOn: true,
    useStaticIp: false,
    useLocalTime: true,
    smsSender: "0211112222",
    kakaoSender: "test-channel",
    faxSender: "0222223333",
  }),
}));
const loadFaxDocumentData = vi.fn();
vi.mock("@/lib/bill/faxData", () => ({ loadFaxDocumentData: (...a: unknown[]) => loadFaxDocumentData(...a) }));
const renderFaxPdf = vi.fn();
vi.mock("@/lib/bill/faxPdf", () => ({ renderFaxPdf: (...a: unknown[]) => renderFaxPdf(...a) }));
const submitFax = vi.fn();
vi.mock("@/lib/popbill/fax", () => ({ submitFax: (...a: unknown[]) => submitFax(...a) }));

import { POST } from "./route";
import { PopbillSubmitError, PopbillTimeoutError } from "@/lib/popbill/types";
import { PopbillNotConfiguredError } from "@/lib/popbill/config";

function req(body: unknown): Request {
  return new Request("http://x/api/bill/fax/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const doc = { orgId: 10, faxNumber: "02-333-4444", householdName: "홍길동", building: { name: "그린빌라" } };

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
  setupMaybeSingle.mockResolvedValue({ data: null, error: null });
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
    setupMaybeSingle.mockResolvedValueOnce({ data: { fax_sender: "0233334444" }, error: null });
    const res = await POST(req({ billIssueIds: [5] }));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ queued: 1, failed: 0 });
    expect(renderFaxPdf).toHaveBeenCalledTimes(1);
    expect(submitFax).toHaveBeenCalledTimes(1);
    expect(submitFax.mock.calls[0][1]).toMatchObject({ faxSender: "0233334444" });
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

  it("PDF 렌더 실패 시 작업을 failed로 마킹해 submitting 잔류 없이 재시도를 허용한다", async () => {
    renderFaxPdf.mockRejectedValue(new Error("render boom"));
    const res = await POST(req({ billIssueIds: [5] }));
    expect(await res.json()).toMatchObject({ queued: 0, failed: 1 });
    // 접수 시도 전 실패이므로 provider 호출은 없어야 하고, 생성된 job은 failed로 마킹되어야 한다.
    expect(submitFax).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith(
      "mark_fax_dispatch_result",
      expect.objectContaining({ p_job_id: 1, p_outcome: "failed" }),
    );
  });

  it("create_fax_dispatch_job RPC 오류를 무시하지 않고 failed로 처리한다(렌더/접수 없음)", async () => {
    adminRpc.mockImplementation((name: string) =>
      name === "create_fax_dispatch_job"
        ? Promise.resolve({ data: null, error: { message: "db down" } })
        : Promise.resolve({ data: { ok: true }, error: null }),
    );
    const res = await POST(req({ billIssueIds: [5] }));
    expect(await res.json()).toMatchObject({ queued: 0, failed: 1 });
    expect(renderFaxPdf).not.toHaveBeenCalled();
    expect(submitFax).not.toHaveBeenCalled();
  });

  it("provider 접수는 성공했으나 mark RPC가 실패하면 queued로 거짓 보고하지 않는다", async () => {
    adminRpc.mockImplementation((name: string) => {
      if (name === "create_fax_dispatch_job") {
        return Promise.resolve({ data: { ok: true, job_id: 1, request_num: "f5a0", provider_ref_key: "f5a0" }, error: null });
      }
      if (name === "mark_fax_dispatch_result") {
        return Promise.resolve({ data: null, error: { message: "db down" } });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });
    const res = await POST(req({ billIssueIds: [5] }));
    const json = await res.json();
    expect(submitFax).toHaveBeenCalledTimes(1);
    expect(json.queued).toBe(0); // DB 반영 실패를 queued로 거짓 보고하지 않는다
    expect(json.results[0].status).toBe("mark_failed");
  });

  it("접수 타임아웃(PopbillTimeoutError)은 reconcile_required로 남기고 queued로 보고하지 않는다", async () => {
    submitFax.mockRejectedValue(new PopbillTimeoutError());
    const res = await POST(req({ billIssueIds: [5] }));
    const json = await res.json();
    expect(json.queued).toBe(0);
    expect(json.results[0].status).toBe("reconcile_required");
    expect(adminRpc).toHaveBeenCalledWith(
      "mark_fax_dispatch_result",
      expect.objectContaining({ p_job_id: 1, p_outcome: "unknown" }),
    );
  });

  it("발신 설정 누락(PopbillNotConfiguredError)은 unknown이 아니라 failed(확정)로 처리한다", async () => {
    // 설정/사전(pre-provider) 오류는 접수가 확정 거부된 것이므로 재조회 대상(unknown)이 아니라 즉시 failed다.
    submitFax.mockRejectedValue(new PopbillNotConfiguredError("Popbill fax 발신 설정이 없습니다."));
    const res = await POST(req({ billIssueIds: [5] }));
    const json = await res.json();
    expect(json.failed).toBe(1);
    expect(json.reconcileRequired ?? 0).toBe(0);
    expect(json.results[0].status).toBe("failed");
    expect(adminRpc).toHaveBeenCalledWith(
      "mark_fax_dispatch_result",
      expect.objectContaining({ p_job_id: 1, p_outcome: "failed" }),
    );
  });

  it("mark RPC가 data.ok=false를 반환하면(전송오류 아님) accepted를 queued로 거짓 보고하지 않는다", async () => {
    adminRpc.mockImplementation((name: string) => {
      if (name === "create_fax_dispatch_job") {
        return Promise.resolve({ data: { ok: true, job_id: 1, request_num: "f5a0", provider_ref_key: "f5a0" }, error: null });
      }
      if (name === "mark_fax_dispatch_result") {
        // 전송 오류는 없지만 RPC가 실패를 데이터로 알린다(예: JOB_NOT_FOUND).
        return Promise.resolve({ data: { ok: false, code: "JOB_NOT_FOUND" }, error: null });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });
    const res = await POST(req({ billIssueIds: [5] }));
    const json = await res.json();
    expect(submitFax).toHaveBeenCalledTimes(1);
    expect(json.queued).toBe(0);
    expect(json.results[0].status).toBe("mark_failed");
  });

  it("PDF 렌더 실패 후 mark까지 실패하면 terminal(render_failed)로 주장하지 않고 mark_failed로 남긴다", async () => {
    renderFaxPdf.mockRejectedValue(new Error("render boom"));
    adminRpc.mockImplementation((name: string) => {
      if (name === "create_fax_dispatch_job") {
        return Promise.resolve({ data: { ok: true, job_id: 1, request_num: "f5a0", provider_ref_key: "f5a0" }, error: null });
      }
      if (name === "mark_fax_dispatch_result") {
        return Promise.resolve({ data: null, error: { message: "db down" } });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });
    const res = await POST(req({ billIssueIds: [5] }));
    const json = await res.json();
    expect(submitFax).not.toHaveBeenCalled(); // provider 접수 없음(중복 전송 없음)
    expect(json.results[0].status).toBe("mark_failed");
    expect(json.failed).toBe(0);
    expect(json.reconcileRequired).toBe(1);
  });

  it("접수 확정 실패(SubmitError) 후 mark까지 실패하면 terminal(failed)로 주장하지 않고 mark_failed로 남긴다", async () => {
    submitFax.mockRejectedValue(new PopbillSubmitError("506", "발신번호 오류"));
    adminRpc.mockImplementation((name: string) => {
      if (name === "create_fax_dispatch_job") {
        return Promise.resolve({ data: { ok: true, job_id: 1, request_num: "f5a0", provider_ref_key: "f5a0" }, error: null });
      }
      if (name === "mark_fax_dispatch_result") {
        return Promise.resolve({ data: null, error: { message: "db down" } });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });
    const res = await POST(req({ billIssueIds: [5] }));
    const json = await res.json();
    expect(submitFax).toHaveBeenCalledTimes(1);
    expect(json.results[0].status).toBe("mark_failed");
    expect(json.failed).toBe(0);
    expect(json.reconcileRequired).toBe(1);
  });

  it("mark 전송 오류가 한 번 나도 유한 재시도로 중복 접수 없이 반영된다", async () => {
    let markCalls = 0;
    adminRpc.mockImplementation((name: string) => {
      if (name === "create_fax_dispatch_job") {
        return Promise.resolve({ data: { ok: true, job_id: 1, request_num: "f5a0", provider_ref_key: "f5a0" }, error: null });
      }
      if (name === "mark_fax_dispatch_result") {
        markCalls += 1;
        return markCalls === 1
          ? Promise.resolve({ data: null, error: { message: "db blip" } })
          : Promise.resolve({ data: { ok: true }, error: null });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });
    const res = await POST(req({ billIssueIds: [5] }));
    const json = await res.json();
    expect(submitFax).toHaveBeenCalledTimes(1); // 재시도는 mark만, provider 재접수 없음
    expect(markCalls).toBe(2);
    expect(json.queued).toBe(1);
    expect(json.results[0].status).toBe("queued");
  });
});
