import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { reconcilePendingDeliveries } from "@/lib/messaging/reconcile";
import type { ProviderRecipientResult } from "@/lib/popbill/results";

type RpcArgs = Record<string, unknown>;
type FetchResults = (job: { product: string; receiptNum: string; kind: string }) => Promise<ProviderRecipientResult[]>;

function makeAdmin(handlers: Record<string, (args: RpcArgs) => unknown>) {
  const calls: { fn: string; args: RpcArgs }[] = [];
  const admin = {
    rpc: vi.fn(async (fn: string, args: RpcArgs = {}) => {
      calls.push({ fn, args });
      const handler = handlers[fn];
      return { data: handler ? handler(args) : null, error: null };
    }),
  };
  return { admin, calls };
}

const NOW = new Date("2026-08-24T12:00:00.000Z");
const recent = new Date(NOW.getTime() - 3 * 60_000).toISOString();

let fetchResults: Mock<FetchResults>;
beforeEach(() => {
  fetchResults = vi.fn();
});

function job(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    kind: "message",
    product: "sms",
    receipt_num: "R1",
    request_num: "m5c0",
    reservation_id: 5,
    submitted_at: recent,
    created_at: recent,
    ...overrides,
  };
}

describe("reconcilePendingDeliveries", () => {
  it("state=3/result=100 성공 → 성공 결과 반영·job 최종화(finalized)", async () => {
    fetchResults.mockResolvedValue([{ providerRefKey: "r0", status: "success", code: "100" }]);
    const { admin, calls } = makeAdmin({
      claim_provider_dispatch_jobs: () => [job()],
      apply_provider_dispatch_results: () => ({ ok: true, job_status: "sent" }),
    });

    const result = await reconcilePendingDeliveries({ admin, now: NOW, fetchResults });

    expect(result).toMatchObject({ processed: 1, finalized: 1, pending: 0, reconcileRequired: 0 });
    const applyArgs = calls.find((c) => c.fn === "apply_provider_dispatch_results")?.args;
    expect(applyArgs?.p_results).toEqual([{ provider_ref_key: "r0", status: "success", code: "100" }]);
    expect(applyArgs?.p_next_poll_at).toEqual(expect.any(String));
  });

  it("pending 결과는 반영 목록에서 제외하고 job은 pending 유지", async () => {
    fetchResults.mockResolvedValue([{ providerRefKey: "r0", status: "pending", code: "1" }]);
    const { admin, calls } = makeAdmin({
      claim_provider_dispatch_jobs: () => [job()],
      apply_provider_dispatch_results: () => ({ ok: true, job_status: "pending" }),
    });

    const result = await reconcilePendingDeliveries({ admin, now: NOW, fetchResults });

    expect(result).toMatchObject({ processed: 1, pending: 1, finalized: 0 });
    expect(calls.find((c) => c.fn === "apply_provider_dispatch_results")?.args.p_results).toEqual([]);
  });

  it("24시간 초과면 next_poll_at=null(reconcile_required)로 전달", async () => {
    fetchResults.mockResolvedValue([{ providerRefKey: "r0", status: "pending", code: "1" }]);
    const old = new Date(NOW.getTime() - 25 * 3_600_000).toISOString();
    const { admin, calls } = makeAdmin({
      claim_provider_dispatch_jobs: () => [job({ submitted_at: old, created_at: old })],
      apply_provider_dispatch_results: () => ({ ok: true, job_status: "reconcile_required" }),
    });

    const result = await reconcilePendingDeliveries({ admin, now: NOW, fetchResults });

    expect(result).toMatchObject({ reconcileRequired: 1 });
    expect(calls.find((c) => c.fn === "apply_provider_dispatch_results")?.args.p_next_poll_at).toBeNull();
  });

  it("조회 실패 시 빈 결과로 apply를 계속 호출한다", async () => {
    fetchResults.mockRejectedValue(new Error("network"));
    const { admin, calls } = makeAdmin({
      claim_provider_dispatch_jobs: () => [job()],
      apply_provider_dispatch_results: () => ({ ok: true, job_status: "pending" }),
    });

    const result = await reconcilePendingDeliveries({ admin, now: NOW, fetchResults });

    expect(result.pending).toBe(1);
    expect(calls.find((c) => c.fn === "apply_provider_dispatch_results")?.args.p_results).toEqual([]);
  });

  it("receipt가 없는 fenced job은 RequestNum으로 조회한다", async () => {
    const fetchResultsByRequestNum = vi.fn().mockResolvedValue([
      { providerRefKey: "r0", status: "pending", code: "1" },
    ]);
    const { admin } = makeAdmin({
      claim_provider_dispatch_jobs: () => [job({ receipt_num: null, request_num: "m5c0" })],
      apply_provider_dispatch_results: () => ({ ok: true, job_status: "reconcile_required" }),
    });

    const result = await reconcilePendingDeliveries({
      admin,
      now: NOW,
      fetchResults,
      fetchResultsByRequestNum,
    });

    expect(fetchResults).not.toHaveBeenCalled();
    expect(fetchResultsByRequestNum).toHaveBeenCalledWith({
      product: "sms",
      requestNum: "m5c0",
      kind: "message",
    });
    expect(result.reconcileRequired).toBe(1);
  });

  it("팩스(kind=fax) 성공 결과를 페이지 수와 함께 반영한다(finalized)", async () => {
    const fetchFax = vi.fn().mockResolvedValue({
      status: "success",
      sendPages: 1,
      successPages: 1,
      failPages: 0,
      chargePages: 1,
      refundPages: 0,
      code: "100",
    });
    const { admin, calls } = makeAdmin({
      claim_provider_dispatch_jobs: () => [job({ id: 2, kind: "fax", product: "fax", receipt_num: "FAX-1", reservation_id: null })],
      apply_fax_dispatch_result: () => ({ ok: true, job_status: "sent" }),
    });

    const result = await reconcilePendingDeliveries({ admin, now: NOW, fetchResults, fetchFax });

    expect(result).toMatchObject({ processed: 1, finalized: 1 });
    expect(fetchFax).toHaveBeenCalledWith({ receiptNum: "FAX-1" });
    expect(fetchResults).not.toHaveBeenCalled();
    const applyArgs = calls.find((c) => c.fn === "apply_fax_dispatch_result")?.args;
    expect(applyArgs).toMatchObject({ p_job_id: 2, p_status: "sent", p_success_pages: 1, p_charge_pages: 1 });
  });

  it("팩스 부분 성공은 partial 상태로 반영한다", async () => {
    const fetchFax = vi.fn().mockResolvedValue({
      status: "partial", sendPages: 2, successPages: 1, failPages: 1, chargePages: 1, refundPages: 1, code: "517",
    });
    const { admin, calls } = makeAdmin({
      claim_provider_dispatch_jobs: () => [job({ id: 3, kind: "fax", product: "fax", receipt_num: "FAX-2", reservation_id: null })],
      apply_fax_dispatch_result: () => ({ ok: true, job_status: "partial" }),
    });

    const result = await reconcilePendingDeliveries({ admin, now: NOW, fetchResults, fetchFax });
    expect(result.finalized).toBe(1);
    expect(calls.find((c) => c.fn === "apply_fax_dispatch_result")?.args.p_status).toBe("partial");
  });
});
