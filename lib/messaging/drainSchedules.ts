import type { AlimtalkButton } from "@/lib/messaging/alimtalk";
import { anyChannelConfigured, dispatchOne } from "@/lib/messaging/dispatch";
import type { MessageChannel } from "@/lib/messaging/preset";

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}

export interface SupabaseClientLike {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
}

export interface DrainDeps {
  admin: SupabaseClientLike;
  orgId: number | null;
  limit?: number;
}

export interface DrainResult {
  claimed: number;
  sent: number;
  failed: number;
  unconfigured: number;
  chargedPoints: number;
}

interface ClaimRow {
  id: number;
  org_id: number;
  channel: MessageChannel | "auto";
  body: string;
  context: string;
  recipients: unknown;
  template_id: number | null;
}

interface ReserveResult {
  ok: boolean;
  code?: string;
  reservation_status?: "reserved" | "settled" | "released";
  reservation_id?: number;
  message_log_id?: number;
  log_result?: string;
  resolved_recipients?: { phone: string; channel: MessageChannel }[];
  recipient_costs?: { recipient_key: string; channel?: MessageChannel }[];
  alimtalk_template_code?: string | null;
  buttons?: AlimtalkButton[];
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
): Promise<void> {
  if (!anyChannelConfigured(row.channel)) {
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

  // 크래시 후 재claim된 정산 완료 예약은 재발송하지 않고 기존 로그 결과로 마감한다.
  if (reserve.reservation_status && reserve.reservation_status !== "reserved") {
    const final =
      reserve.log_result === "sent" || reserve.log_result === "partial" ? "sent" : "failed";
    await complete(admin, row.id, reserve.message_log_id ?? null, final);
    if (final === "sent") result.sent += 1;
    else result.failed += 1;
    return;
  }

  const resolved = reserve.resolved_recipients ?? [];
  const costs = reserve.recipient_costs ?? [];
  const results: { recipient_key: string; status: "success" | "failed" }[] = [];
  let providerRequestId: string | null = null;

  for (let index = 0; index < resolved.length; index += 1) {
    const recipientKey = costs[index]?.recipient_key;
    if (!recipientKey) continue;

    const recipient = resolved[index];
    const dispatch = await dispatchOne({
      channel: recipient.channel,
      phone: recipient.phone,
      body: row.body,
      templateCode:
        recipient.channel === "alimtalk" ? reserve.alimtalk_template_code ?? null : null,
      buttons: recipient.channel === "alimtalk" ? reserve.buttons : undefined,
    });
    if (dispatch.providerId && !providerRequestId) providerRequestId = dispatch.providerId;
    results.push({ recipient_key: recipientKey, status: dispatch.status });
  }

  const settle = (await rpc(admin, "settle_message_points", {
    p_reservation_id: reserve.reservation_id,
    p_provider_request_id: providerRequestId,
    p_results: results,
  })) as { result?: string; status?: string; charged_points?: number };

  const outcome = settle?.result ?? settle?.status;
  const final = outcome === "sent" || outcome === "partial" ? "sent" : "failed";
  await complete(admin, row.id, reserve.message_log_id ?? null, final);
  if (final === "sent") result.sent += 1;
  else result.failed += 1;
  result.chargedPoints += settle?.charged_points ?? 0;
}

export async function drainSchedules({
  admin,
  orgId,
  limit = 50,
}: DrainDeps): Promise<DrainResult> {
  const result: DrainResult = {
    claimed: 0,
    sent: 0,
    failed: 0,
    unconfigured: 0,
    chargedPoints: 0,
  };
  const claimed = (await rpc(admin, "claim_due_message_schedules", {
    p_org_id: orgId,
    p_limit: limit,
  })) as ClaimRow[] | null;
  const rows = claimed ?? [];
  result.claimed = rows.length;

  for (const row of rows) {
    try {
      await processRow(admin, row, result);
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
