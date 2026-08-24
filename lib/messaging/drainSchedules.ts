import { isPopbillConfigured } from "@/lib/popbill/config";
import type { MessageBatchInput, MessageContent, ProviderSubmission } from "@/lib/popbill/types";
import {
  submitReservationBatches,
  toPopbillButtons,
  type SupabaseClientLike,
} from "./dispatch";

/**
 * 예약 발송 worker — Popbill 접수 기반.
 *
 * claim → reserve(로그 즉시 연결) → 제품별 배치 접수 → provider_pending. 즉시 정산하지 않는다.
 * 최종 결과는 /api/delivery/reconcile 재조회가 확정하고 스케줄/고지서를 최종화한다.
 * 접수만으로 sent가 되지 않으며, 미설정이면 failed로 마감한다.
 */

export interface DrainDeps {
  admin: SupabaseClientLike;
  orgId: number | null;
  limit?: number;
  submitBatch?: (batch: MessageBatchInput, content: MessageContent) => Promise<ProviderSubmission>;
  isConfigured?: () => boolean;
}

export interface DrainResult {
  claimed: number;
  /** 접수 완료(결과 확인 대기). 성공 확정 수가 아니다. */
  queued: number;
  failed: number;
  unconfigured: number;
  /** 크래시 후 재claim 시 이미 정산된 예약을 마감 처리한 수. */
  finalized: number;
}

interface ClaimRow {
  id: number;
  org_id: number;
  channel: string;
  body: string;
  context: string;
  recipients: unknown;
  template_id: number | null;
}

interface ReserveResult {
  ok: boolean;
  code?: string;
  replayed?: boolean;
  reservation_status?: "reserved" | "provider_pending" | "settled" | "released" | "reconcile_required";
  reservation_id?: number;
  message_log_id?: number;
  log_result?: string;
  resolved_recipients?: Array<Record<string, unknown>>;
  recipient_costs?: Array<Record<string, unknown>>;
  alimtalk_template_code?: string | null;
  buttons?: unknown;
}

async function rpc(
  admin: SupabaseClientLike,
  fn: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

async function complete(
  admin: SupabaseClientLike,
  id: number,
  logId: number | null,
  final: "sent" | "failed",
): Promise<void> {
  await rpc(admin, "complete_message_schedule", {
    p_schedule_id: id,
    p_message_log_id: logId,
    p_final: final,
  });
}

async function processRow(
  admin: SupabaseClientLike,
  row: ClaimRow,
  result: DrainResult,
  deps: DrainDeps,
): Promise<void> {
  const isConfigured = deps.isConfigured ?? isPopbillConfigured;
  if (!isConfigured()) {
    await complete(admin, row.id, null, "failed");
    result.unconfigured += 1;
    return;
  }

  const reserve = (await rpc(admin, "reserve_scheduled_message", {
    p_schedule_id: row.id,
  })) as ReserveResult;
  if (!reserve?.ok) {
    await complete(admin, row.id, null, "failed");
    result.failed += 1;
    return;
  }

  // 크래시 후 재claim된, 이미 정산 완료된 예약은 재발송하지 않고 기존 로그 결과로 마감한다.
  if (reserve.reservation_status === "settled" || reserve.reservation_status === "released") {
    const final = reserve.log_result === "sent" || reserve.log_result === "partial" ? "sent" : "failed";
    await complete(admin, row.id, reserve.message_log_id ?? null, final);
    result.finalized += 1;
    return;
  }

  // 예약(또는 접수 진행 중) — 배치 접수. 로그는 reserve에서 이미 스케줄에 연결됨.
  const { markStatus } = await submitReservationBatches(
    admin,
    {
      reservationId: reserve.reservation_id as number,
      scheduleId: row.id,
      body: row.body,
      templateId: row.template_id,
      resolved: reserve.resolved_recipients ?? [],
      costs: reserve.recipient_costs ?? [],
    },
    {
      submitBatch: deps.submitBatch,
      loadAlimtalkTemplate: async () => ({
        templateCode: reserve.alimtalk_template_code ?? null,
        buttons: toPopbillButtons(reserve.buttons),
      }),
    },
  );

  if (markStatus === "released") {
    // 접수가 전부 확정 실패 → 예약은 반환됨. 스케줄을 실패로 마감한다.
    await complete(admin, row.id, reserve.message_log_id ?? null, "failed");
    result.failed += 1;
    return;
  }

  // provider_pending / reconcile_required → 스케줄은 sending으로 유지(재조회가 최종화).
  result.queued += 1;
}

export async function drainSchedules(deps: DrainDeps): Promise<DrainResult> {
  const { admin, orgId, limit = 50 } = deps;
  const result: DrainResult = {
    claimed: 0,
    queued: 0,
    failed: 0,
    unconfigured: 0,
    finalized: 0,
  };
  const claimed = (await rpc(admin, "claim_due_message_schedules", {
    p_org_id: orgId,
    p_limit: limit,
  })) as ClaimRow[] | null;
  const rows = claimed ?? [];
  result.claimed = rows.length;

  for (const row of rows) {
    try {
      await processRow(admin, row, result, deps);
    } catch {
      try {
        await complete(admin, row.id, null, "failed");
      } catch {
        // 다음 claim에서 stale sending 행을 회수할 수 있도록 원래 예외를 격리한다.
      }
      result.failed += 1;
    }
  }

  return result;
}
