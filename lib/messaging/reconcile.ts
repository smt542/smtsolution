import { readPopbillConfig, type PopbillConfig } from "@/lib/popbill/config";
import {
  computeNextPollAt,
  defaultFetchResults,
  type ProviderRecipientResult,
} from "@/lib/popbill/results";
import type { SupabaseClientLike } from "./dispatch";

/**
 * Popbill 결과 재조회 및 멱등 정산.
 *
 * DB claim(FOR UPDATE SKIP LOCKED)로 pending 작업을 임대 → 제품별 결과 조회 →
 * terminal 수신자 upsert·job 집계 → 예약의 모든 job이 terminal이면 성공분만 정산.
 * 중복 실행/중복 결과는 apply RPC와 DB 제약으로 한 번만 최종화된다.
 */

export interface ReconcileJob {
  id: number;
  kind: string;
  product: string;
  receipt_num: string | null;
  reservation_id: number | null;
  submitted_at: string | null;
  created_at: string;
}

export interface ReconcileDeps {
  admin: SupabaseClientLike;
  limit?: number;
  now?: Date;
  config?: PopbillConfig;
  fetchResults?: (job: {
    product: string;
    receiptNum: string;
    kind: string;
  }) => Promise<ProviderRecipientResult[]>;
}

export interface ReconcileResult {
  processed: number;
  pending: number;
  finalized: number;
  reconcileRequired: number;
}

async function rpcData(
  admin: SupabaseClientLike,
  fn: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function reconcilePendingDeliveries(deps: ReconcileDeps): Promise<ReconcileResult> {
  const limit = deps.limit ?? 50;
  const now = deps.now ?? new Date();
  const config = deps.config;
  const fetchResults =
    deps.fetchResults ?? ((job) => defaultFetchResults(job, config ?? readPopbillConfig()));

  const jobs = (await rpcData(deps.admin, "claim_provider_dispatch_jobs", {
    p_limit: limit,
  })) as ReconcileJob[] | null;

  const result: ReconcileResult = { processed: 0, pending: 0, finalized: 0, reconcileRequired: 0 };

  for (const job of jobs ?? []) {
    result.processed += 1;
    // 팩스(kind=fax)는 Task 9에서 처리한다. 여기서는 문자/알림톡만 확정한다.
    if (job.kind !== "message") continue;

    let results: ProviderRecipientResult[] = [];
    if (job.receipt_num) {
      try {
        results = await fetchResults({
          product: job.product,
          receiptNum: job.receipt_num,
          kind: job.kind,
        });
      } catch {
        // 조회 실패 → 빈 결과로 진행(재스케줄, 24시간 초과 시 reconcile_required).
        results = [];
      }
    }

    const submittedAt = new Date(job.submitted_at ?? job.created_at);
    const nextPollAt = computeNextPollAt(submittedAt, now);

    const applied = (await rpcData(deps.admin, "apply_provider_dispatch_results", {
      p_job_id: job.id,
      p_results: results
        .filter((r) => r.status !== "pending")
        .map((r) => ({ provider_ref_key: r.providerRefKey, status: r.status, code: r.code })),
      p_next_poll_at: nextPollAt ? nextPollAt.toISOString() : null,
    })) as { job_status?: string } | null;

    const status = applied?.job_status;
    if (status === "sent" || status === "partial" || status === "failed") {
      result.finalized += 1;
    } else if (status === "reconcile_required") {
      result.reconcileRequired += 1;
    } else {
      result.pending += 1;
    }
  }

  return result;
}
