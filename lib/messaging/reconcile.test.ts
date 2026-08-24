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

  it("팩스(kind=fax) 작업은 이 단계에서 건너뛴다", async () => {
    const { admin, calls } = makeAdmin({
      claim_provider_dispatch_jobs: () => [job({ kind: "fax", product: "fax" })],
    });

    const result = await reconcilePendingDeliveries({ admin, now: NOW, fetchResults });

    expect(result.processed).toBe(1);
    expect(fetchResults).not.toHaveBeenCalled();
    expect(calls.some((c) => c.fn === "apply_provider_dispatch_results")).toBe(false);
  });
});
