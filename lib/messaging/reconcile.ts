import { isPopbillConfigured, readPopbillConfig, type PopbillConfig } from "@/lib/popbill/config";
import {
  computeNextPollAt,
  defaultFetchFax,
  defaultFetchResults,
  defaultFetchResultsByRequestNum,
  type FaxResultSummary,
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
  request_num: string;
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
  fetchResultsByRequestNum?: (job: {
    product: string;
    requestNum: string;
    kind: string;
  }) => Promise<ProviderRecipientResult[]>;
  fetchFax?: (job: { receiptNum: string }) => Promise<FaxResultSummary>;
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
  const fetchFax = deps.fetchFax ?? ((job) => defaultFetchFax(job, config ?? readPopbillConfig()));
  const fetchResultsByRequestNum =
    deps.fetchResultsByRequestNum ??
    ((job) => defaultFetchResultsByRequestNum(job, config ?? readPopbillConfig()));

  // 같은 환경(test/live)에서 접수한 작업만 재조회한다(spec 4.2②). 팝빌 설정이 없으면 기존처럼 전체.
  const envConfig = config ?? (isPopbillConfigured() ? readPopbillConfig() : null);
  const providerEnv = envConfig ? (envConfig.isTest ? "test" : "live") : null;

  const jobs = (await rpcData(deps.admin, "claim_provider_dispatch_jobs", {
    p_limit: limit,
    p_provider_env: providerEnv,
  })) as ReconcileJob[] | null;

  const result: ReconcileResult = { processed: 0, pending: 0, finalized: 0, reconcileRequired: 0 };

  for (const job of jobs ?? []) {
    result.processed += 1;
    const submittedAtBase = new Date(job.submitted_at ?? job.created_at);

    if (job.kind === "fax") {
      let fax: FaxResultSummary | null = null;
      if (job.receipt_num) {
        try {
          fax = await fetchFax({ receiptNum: job.receipt_num });
        } catch (error) {
          console.error("[reconcile] fax result lookup failed", { jobId: job.id, error: (error as Error)?.message });
          fax = null;
        }
      }
      const faxNext = computeNextPollAt(submittedAtBase, now);
      // 성공(success)→sent로 매핑. 미조회/조회실패는 pending으로 두어 재스케줄한다.
      const faxStatus = fax ? (fax.status === "success" ? "sent" : fax.status) : "pending";
      const faxApplied = (await rpcData(deps.admin, "apply_fax_dispatch_result", {
        p_job_id: job.id,
        p_status: faxStatus,
        p_send_pages: fax?.sendPages ?? 0,
        p_success_pages: fax?.successPages ?? 0,
        p_fail_pages: fax?.failPages ?? 0,
        p_charge_pages: fax?.chargePages ?? 0,
        p_refund_pages: fax?.refundPages ?? 0,
        p_next_poll_at: faxNext ? faxNext.toISOString() : null,
      })) as { job_status?: string } | null;
      const fs = faxApplied?.job_status;
      if (fs === "sent" || fs === "partial" || fs === "failed") result.finalized += 1;
      else if (fs === "reconcile_required") result.reconcileRequired += 1;
      else result.pending += 1;
      continue;
    }

    if (job.kind !== "message") continue;

    let results: ProviderRecipientResult[] = [];
    if (job.receipt_num || job.request_num) {
      try {
        results = job.receipt_num
          ? await fetchResults({
              product: job.product,
              receiptNum: job.receipt_num,
              kind: job.kind,
            })
          : await fetchResultsByRequestNum({
              product: job.product,
              requestNum: job.request_num,
              kind: job.kind,
            });
      } catch (error) {
        // 조회 실패 → 빈 결과로 진행(재스케줄, 24시간 초과 시 reconcile_required). 원인은 로그로 남긴다.
        console.error("[reconcile] message result lookup failed", { jobId: job.id, error: (error as Error)?.message });
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
