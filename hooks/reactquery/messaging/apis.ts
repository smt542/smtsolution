import { createClient } from "@/lib/supabase/client";
import type {
  MessageRecipient,
  ResolvedRecipient,
  SendMode,
} from "@/lib/messaging/preset";

export interface MessageLog {
  id: number;
  orgId: number;
  channel: SendMode;
  body: string;
  context: string;
  recipientCount: number;
  recipients: MessageRecipient[];
  result: string;
  sentBy: string | null;
  sentAt: string;
  templateId: number | null;
  estimatedPoints: number;
  chargedPoints: number;
  pointStatus:
    | "none"
    | "quoted"
    | "reserved"
    | "settled"
    | "released"
    | "reconcile_required";
}

export interface SendMessagesInput {
  mode: SendMode;
  body: string;
  context: string;
  templateId: number | null;
  recipients: ResolvedRecipient[];
  scheduledAt?: string | null;
  recurrenceMode?: "monthly" | null;
  recurrenceAnchorDay?: number | null;
  /** 한 논리적 즉시발송 시도의 멱등 키(UUID). Idempotency-Key 헤더로 전달한다. */
  idempotencyKey?: string;
}

export interface SendMessagesResult {
  logId: number;
  count: number;
  /** queued=Popbill 접수 완료(결과 확인 중), scheduled=예약 등록 완료 */
  status: "queued" | "scheduled";
  scheduledAt: string | null;
  recipients: ResolvedRecipient[];
  /** 접수된 수신자 수(즉시발송). 성공 확정 수가 아니다. */
  queuedCount?: number;
  reservedPoints?: number;
}

export interface MessagePointQuoteInput {
  mode: SendMode;
  recipients: MessageRecipient[];
  templateId: number | null;
  /** 최종 렌더링 본문. SMS/LMS 제품을 서버에서 바이트로 판정하기 위해 전달한다. */
  body?: string;
}

export interface MessagePointQuote {
  recipientCount: number;
  excludedCount: number;
  channelCounts: { sms: number; lms: number; alimtalk: number };
  rateSnapshot: {
    sms: { rateId: number; points: number };
    lms: { rateId: number; points: number };
    alimtalk: { rateId: number; points: number };
  };
  ledgerBalance: number;
  reservedPoints: number;
  availablePoints: number;
  estimatedPoints: number;
  sufficient: boolean;
}

export class MessagePointQuoteError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "MessagePointQuoteError";
  }
}

export class MessageSendError extends Error {
  constructor(public readonly code: string, message: string, public readonly detail?: unknown) {
    super(message);
    this.name = "MessageSendError";
  }
}

type MessageLogRow = {
  id: number;
  org_id: number;
  channel: SendMode;
  body: string;
  context: string;
  recipient_count: number;
  recipients: MessageRecipient[];
  result: string;
  sent_by: string | null;
  sent_at: string;
  template_id: number | null;
  estimated_points?: number;
  charged_points?: number;
  point_status?: MessageLog["pointStatus"];
};

const rowToMessageLog = (row: MessageLogRow): MessageLog => ({
  id: row.id,
  orgId: row.org_id,
  channel: row.channel,
  body: row.body,
  context: row.context,
  recipientCount: row.recipient_count,
  recipients: row.recipients,
  result: row.result,
  sentBy: row.sent_by,
  sentAt: row.sent_at,
  templateId: row.template_id,
  estimatedPoints: row.estimated_points ?? 0,
  chargedPoints: row.charged_points ?? 0,
  pointStatus: row.point_status ?? "none",
});

export async function quoteMessagePoints(
  input: MessagePointQuoteInput,
): Promise<MessagePointQuote> {
  const { data, error } = await createClient().rpc("quote_message_points", {
    p_mode: input.mode,
    p_recipients: input.recipients,
    p_template_id: input.templateId,
    p_body: input.body ?? null,
  });
  if (error) throw new Error(error.message);

  const result = data as {
    ok?: boolean;
    code?: string;
    message?: string;
    counts?: { total?: number; sms?: number; lms?: number; alimtalk?: number };
    excluded_count?: number;
    rate_snapshot?: {
      sms?: { id?: number; points?: number };
      lms?: { id?: number; points?: number };
      alimtalk?: { id?: number; points?: number };
    };
    ledger_balance?: number;
    reserved_points?: number;
    available_points?: number;
    estimated_points?: number;
    sufficient?: boolean;
  } | null;

  if (!result?.ok) {
    throw new MessagePointQuoteError(
      result?.code ?? "QUOTE_FAILED",
      result?.message ?? "메시지 포인트 견적을 계산하지 못했습니다.",
    );
  }

  return {
    recipientCount: Number(result.counts?.total ?? 0),
    excludedCount: Number(result.excluded_count ?? 0),
    channelCounts: {
      sms: Number(result.counts?.sms ?? 0),
      lms: Number(result.counts?.lms ?? 0),
      alimtalk: Number(result.counts?.alimtalk ?? 0),
    },
    rateSnapshot: {
      sms: {
        rateId: Number(result.rate_snapshot?.sms?.id ?? 0),
        points: Number(result.rate_snapshot?.sms?.points ?? 0),
      },
      lms: {
        rateId: Number(result.rate_snapshot?.lms?.id ?? 0),
        points: Number(result.rate_snapshot?.lms?.points ?? 0),
      },
      alimtalk: {
        rateId: Number(result.rate_snapshot?.alimtalk?.id ?? 0),
        points: Number(result.rate_snapshot?.alimtalk?.points ?? 0),
      },
    },
    ledgerBalance: Number(result.ledger_balance ?? 0),
    reservedPoints: Number(result.reserved_points ?? 0),
    availablePoints: Number(result.available_points ?? 0),
    estimatedPoints: Number(result.estimated_points ?? 0),
    sufficient: Boolean(result.sufficient),
  };
}

export async function sendMessages(
  input: SendMessagesInput,
): Promise<SendMessagesResult> {
  if (input.scheduledAt) {
    const { data, error } = await createClient().rpc("schedule_messages", {
      p_channel: input.mode,
      p_body: input.body,
      p_context: input.context,
      p_recipients: input.recipients,
      p_template_id: input.templateId,
      p_scheduled_at: input.scheduledAt,
      p_recurrence_mode: input.recurrenceMode ?? null,
      p_recurrence_anchor_day: input.recurrenceAnchorDay ?? null,
    });
    if (error) throw new Error(error.message);
    const result = data as { schedule_id: number; count: number; scheduled_at: string };
    return {
      logId: result.schedule_id,
      count: result.count,
      status: "scheduled",
      scheduledAt: result.scheduled_at,
      recipients: input.recipients,
    };
  }

  // 즉시발송: 서비스롤 라우트(견적→예약→Popbill 접수→provider_pending). 접수만 확정하고 결과는 재조회로 확정.
  // Idempotency-Key로 중복 클릭·재시도가 두 번 발송되지 않게 한다(라우트가 검증, 예약이 replay 처리).
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (input.idempotencyKey) headers["idempotency-key"] = input.idempotencyKey;
  const res = await fetch("/api/messaging/send", {
    method: "POST",
    headers,
    body: JSON.stringify({
      mode: input.mode,
      body: input.body,
      context: input.context,
      templateId: input.templateId,
      recipients: input.recipients,
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    status?: string;
    messageLogId?: number;
    queuedCount?: number;
    reservedPoints?: number;
    error?: string;
    message?: string;
  } | null;
  if (!res.ok) {
    throw new MessageSendError(
      data?.error ?? "SEND_FAILED",
      data?.message ?? "메시지 발송에 실패했습니다.",
      data,
    );
  }
  return {
    logId: data?.messageLogId ?? 0,
    count: input.recipients.length,
    status: "queued",
    scheduledAt: null,
    recipients: input.recipients,
    queuedCount: data?.queuedCount ?? 0,
    reservedPoints: data?.reservedPoints ?? 0,
  };
}

export async function cancelScheduledMessage(scheduleId: number): Promise<void> {
  const { error } = await createClient().rpc("cancel_scheduled_message", {
    p_schedule_id: scheduleId,
  });
  if (error) throw new Error(error.message);
}

export interface TenantConsent { occupancyId: number; alimtalkOptIn: boolean; smsOptIn: boolean; }
type TenantConsentRow = { occupancy_id: number; alimtalk_opt_in: boolean; sms_opt_in: boolean };

export async function listTenantAlimtalkConsent(buildingId: number): Promise<TenantConsent[]> {
  const { data, error } = await createClient().rpc("list_tenant_alimtalk_consent", { p_building_id: buildingId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TenantConsentRow[]).map((r) => ({
    occupancyId: r.occupancy_id, alimtalkOptIn: r.alimtalk_opt_in, smsOptIn: r.sms_opt_in,
  }));
}

export async function listMessageLogs(limit?: number): Promise<MessageLog[]> {
  const { data, error } = await createClient().rpc("list_message_logs", {
    p_limit: limit ?? 50,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as MessageLogRow[]).map(rowToMessageLog);
}

export interface ScheduledMessage {
  id: number;
  channel: SendMode;
  body: string;
  context: string;
  recipientCount: number;
  scheduledAt: string;
  recurrenceMode: "monthly" | null;
}

type ScheduledMessageRow = {
  id: number;
  channel: SendMode;
  body: string;
  context: string;
  recipient_count: number;
  scheduled_at: string;
  recurrence_mode: "monthly" | null;
};

export async function listScheduledMessages(): Promise<ScheduledMessage[]> {
  const { data, error } = await createClient()
    .from("message_schedules")
    .select("id, channel, body, context, recipient_count, scheduled_at, recurrence_mode")
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ScheduledMessageRow[]).map((r) => ({
    id: r.id,
    channel: r.channel,
    body: r.body,
    context: r.context,
    recipientCount: r.recipient_count,
    scheduledAt: r.scheduled_at,
    recurrenceMode: r.recurrence_mode,
  }));
}

export interface DrainScheduledResult {
  claimed: number;
  sent: number;
  failed: number;
  unconfigured: number;
}

export class DrainScheduledError extends Error {
  constructor(public readonly code: "forbidden" | "failed" | "network") {
    super(code);
    this.name = "DrainScheduledError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDrainScheduledResult(value: unknown): value is DrainScheduledResult {
  return isRecord(value)
    && typeof value.claimed === "number"
    && typeof value.sent === "number"
    && typeof value.failed === "number"
    && typeof value.unconfigured === "number";
}

export async function drainScheduledMessages(): Promise<DrainScheduledResult> {
  try {
    const response = await fetch("/api/messaging/dispatch-scheduled", {
      method: "POST",
    });
    const result: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new DrainScheduledError(
        isRecord(result) && result.error === "forbidden" ? "forbidden" : "failed",
      );
    }
    if (!isDrainScheduledResult(result)) {
      throw new DrainScheduledError("failed");
    }
    return result;
  } catch (error) {
    if (error instanceof DrainScheduledError) throw error;
    throw new DrainScheduledError("network");
  }
}
