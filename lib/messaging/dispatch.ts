import { randomUUID, createHash } from "node:crypto";
import type { PopbillKakaoButton } from "popbill";
import { type SendMode, type MessageRecipient } from "./preset";
import { isPopbillConfigured, PopbillNotConfiguredError } from "@/lib/popbill/config";
import { submitMessageBatch } from "@/lib/popbill/messages";
import {
  PopbillSubmitError,
  type MessageBatchInput,
  type MessageContent,
  type ProviderSubmission,
} from "@/lib/popbill/types";
import { buildSubmissionPlan, type PlanProduct, type PlanRecipient } from "./submission";

/**
 * === Popbill 접수 기반 즉시 발송 오케스트레이션 (provider-neutral) ===
 * 인증/권한(라우트) → 서버 견적 → 예약 → submitting 작업 저장 → Popbill 접수 → receipt 저장·provider_pending.
 * 접수만으로 성공/확정 차감하지 않는다. 최종 결과는 별도 재조회(reconcile)로 확정한다.
 */

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}
export interface SupabaseClientLike {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
}

export interface AlimtalkTemplateContent {
  templateCode: string | null;
  buttons: PopbillKakaoButton[];
}

export interface DispatchMessagesInput {
  orgId: number;
  userId: string;
  mode: SendMode;
  body: string;
  context: string;
  templateId: number | null;
  recipients: MessageRecipient[];
}

export interface DispatchMessagesDeps {
  /** 인증된 서버 클라이언트(견적용). current_user 컨텍스트가 필요하다. */
  sb: SupabaseClientLike;
  /** service_role 클라이언트(예약·작업·접수 반영용). */
  admin: SupabaseClientLike;
  loadAlimtalkTemplate?: (templateId: number) => Promise<AlimtalkTemplateContent>;
  submitBatch?: (batch: MessageBatchInput, content: MessageContent) => Promise<ProviderSubmission>;
  isConfigured?: () => boolean;
}

export interface DispatchMessagesResult {
  ok: boolean;
  code?: string;
  message?: string;
  httpStatus?: number;
  detail?: Record<string, unknown> | null;
  status?: "queued";
  logId?: number;
  reservationId?: number;
  queuedCount?: number;
  reservedPoints?: number;
}

interface QuoteData {
  ok?: boolean;
  code?: string;
  message?: string;
  rate_ids?: unknown;
  estimated_points?: number;
  resolved_recipients?: Array<Record<string, unknown>>;
  recipient_costs?: Array<Record<string, unknown>>;
}
interface ReserveData {
  ok?: boolean;
  code?: string;
  replayed?: boolean;
  reservation_id?: number;
  message_log_id?: number;
  reserved_points?: number;
  required_points?: number;
  available_points?: number;
  resolved_recipients?: Array<Record<string, unknown>>;
  recipient_costs?: Array<Record<string, unknown>>;
}

async function rpcData(
  client: SupabaseClientLike,
  fn: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

function normalizePhone(phone: unknown): string {
  return String(phone ?? "").replace(/\D/g, "");
}

function classifySubmitError(e: unknown): {
  outcome: "failed" | "unknown";
  code: string;
  message: string;
} {
  // 접수 호출 전 확정 실패(설정/템플릿/변수)는 failed로 반환 가능. 접수 호출 중 오류는
  // 접수 여부가 불분명하므로 unknown(reconcile_required)으로 남겨 즉시 재발송을 막는다.
  if (e instanceof PopbillNotConfiguredError) {
    return { outcome: "failed", code: e.code, message: "발신 설정이 없습니다." };
  }
  if (e instanceof PopbillSubmitError) {
    const preSend = e.code === "NO_TEMPLATE_CODE" || e.code === "UNRESOLVED_VARIABLES";
    return { outcome: preSend ? "failed" : "unknown", code: e.code, message: e.message };
  }
  return { outcome: "unknown", code: "SUBMIT_ERROR", message: "발송 접수 중 오류가 발생했습니다." };
}

export async function dispatchMessages(
  input: DispatchMessagesInput,
  deps: DispatchMessagesDeps,
): Promise<DispatchMessagesResult> {
  const isConfigured = deps.isConfigured ?? isPopbillConfigured;
  const submitBatch = deps.submitBatch ?? submitMessageBatch;

  if (!isConfigured()) {
    return {
      ok: false,
      code: "PROVIDER_NOT_CONFIGURED",
      message: "발송 공급자가 설정되지 않았습니다.",
      httpStatus: 503,
    };
  }

  // 1) 서버 견적(인증 컨텍스트) — 최종 본문으로 sms/lms/alimtalk 판정
  const quote = (await rpcData(deps.sb, "quote_message_points", {
    p_mode: input.mode,
    p_recipients: input.recipients,
    p_template_id: input.templateId,
    p_body: input.body,
  })) as QuoteData | null;
  if (!quote?.ok) {
    return { ok: false, code: quote?.code ?? "QUOTE_FAILED", message: quote?.message, httpStatus: 400 };
  }

  // 2) 예약(service_role) — 접수 전 하드스톱
  const reserve = (await rpcData(deps.admin, "reserve_message_points", {
    p_org_id: input.orgId,
    p_requested_by: input.userId,
    p_idempotency_key: randomUUID(),
    p_payload_hash: createHash("sha256")
      .update(`${input.mode}|${input.body}|${JSON.stringify(input.recipients)}`)
      .digest("hex")
      .slice(0, 128),
    p_mode: input.mode,
    p_body: input.body,
    p_context: input.context,
    p_recipients: input.recipients,
    p_template_id: input.templateId,
    p_confirmed_rate_ids: quote.rate_ids,
    p_confirmed_points: quote.estimated_points,
  })) as ReserveData | null;
  if (!reserve?.ok) {
    return {
      ok: false,
      code: reserve?.code ?? "RESERVE_FAILED",
      httpStatus: reserve?.code === "INSUFFICIENT_POINTS" ? 402 : 409,
      detail: reserve as Record<string, unknown> | null,
    };
  }

  const reservationId = reserve.reservation_id as number;
  const messageLogId = reserve.message_log_id as number;
  const reservedPoints = reserve.reserved_points ?? 0;

  const resolved = reserve.resolved_recipients ?? quote.resolved_recipients ?? [];
  const costs = reserve.recipient_costs ?? quote.recipient_costs ?? [];

  // 3~7) 배치 계획 → submitting 저장 → Popbill 접수 → provider_pending (예약/스케줄 공용)
  const { queuedCount } = await submitReservationBatches(
    deps.admin,
    {
      reservationId,
      scheduleId: null,
      body: input.body,
      templateId: input.templateId,
      resolved,
      costs,
    },
    { submitBatch, loadAlimtalkTemplate: deps.loadAlimtalkTemplate },
  );

  return {
    ok: true,
    status: "queued",
    logId: messageLogId,
    reservationId,
    queuedCount,
    reservedPoints,
  };
}

/** message_templates.buttons([{name,type,url}]) → Popbill 버튼({t,n,u1}) */
export function toPopbillButtons(raw: unknown): PopbillKakaoButton[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
    .map((b) => ({
      t: String(b.type ?? b.t ?? "WL"),
      n: String(b.name ?? b.n ?? ""),
      u1: b.url != null ? String(b.url) : b.u1 != null ? String(b.u1) : undefined,
    }));
}

export interface SubmitReservationParams {
  reservationId: number;
  scheduleId?: number | null;
  body: string;
  templateId: number | null;
  resolved: Array<Record<string, unknown>>;
  costs: Array<Record<string, unknown>>;
}
export interface SubmitReservationDeps {
  submitBatch?: (batch: MessageBatchInput, content: MessageContent) => Promise<ProviderSubmission>;
  loadAlimtalkTemplate?: (templateId: number) => Promise<AlimtalkTemplateContent>;
}
interface CreatedJobRow {
  request_num: string;
  status?: string;
  receipt_num?: string | null;
}

/**
 * 예약(reservationId)의 수신자를 제품별 배치로 접수한다. 즉시/예약 발송 공용.
 * 재claim/replay 안전: 이미 receipt를 받은 배치는 재발송하지 않고 접수 상태를 유지한다.
 */
export async function submitReservationBatches(
  admin: SupabaseClientLike,
  params: SubmitReservationParams,
  deps: SubmitReservationDeps,
): Promise<{ queuedCount: number; markStatus: string }> {
  const submitBatch = deps.submitBatch ?? submitMessageBatch;

  const planRecipients: PlanRecipient[] = [];
  for (let i = 0; i < params.costs.length; i += 1) {
    const cost = params.costs[i];
    const person = params.resolved[i] ?? {};
    // 수신자별 최종 렌더 본문을 보존한다. 없으면 배치 공통 본문으로 대체된다(접수 시점 대체).
    const rendered = person.renderedBody;
    planRecipients.push({
      recipientKey: String(cost.recipient_key ?? ""),
      phone: normalizePhone(person.phone),
      name: (person.name as string | null) ?? null,
      product: (cost.product as PlanProduct) ?? "sms",
      renderedBody: typeof rendered === "string" && rendered.length > 0 ? rendered : null,
    });
  }
  const plan = buildSubmissionPlan({ scope: "m", id: params.reservationId, recipients: planRecipients });

  let alimtalk: AlimtalkTemplateContent = { templateCode: null, buttons: [] };
  if (plan.some((b) => b.product === "alimtalk") && params.templateId != null && deps.loadAlimtalkTemplate) {
    alimtalk = await deps.loadAlimtalkTemplate(params.templateId);
  }

  const created = (await rpcData(admin, "create_provider_dispatch_jobs", {
    p_reservation_id: params.reservationId,
    p_jobs: plan.map((b) => ({
      product: b.product,
      request_num: b.requestNum,
      schedule_id: params.scheduleId ?? null,
      recipients: b.recipients.map((r) => ({
        recipient_key: r.recipientKey,
        provider_ref_key: r.providerRefKey,
      })),
    })),
  })) as { jobs?: CreatedJobRow[] } | null;
  const jobByReq = new Map((created?.jobs ?? []).map((j) => [j.request_num, j]));

  const outcomes: Array<Record<string, unknown>> = [];
  let queuedCount = 0;
  for (const batch of plan) {
    const info = jobByReq.get(batch.requestNum);
    // 이미 접수번호가 있으면 재발송하지 않고 접수 상태를 유지한다(중복 발송 방지).
    if (info?.receipt_num) {
      outcomes.push({ request_num: batch.requestNum, outcome: "accepted", receipt_num: info.receipt_num });
      queuedCount += batch.recipients.length;
      continue;
    }
    // 이미 terminal/미확인으로 넘어간 작업은 그대로 둔다.
    if (info?.status && info.status !== "submitting") {
      continue;
    }
    const content: MessageContent =
      batch.product === "alimtalk"
        ? { body: params.body, templateCode: alimtalk.templateCode, buttons: alimtalk.buttons }
        : { body: params.body };
    try {
      const submission = await submitBatch(
        { product: batch.product, requestNum: batch.requestNum, recipients: batch.recipients },
        content,
      );
      outcomes.push({ request_num: batch.requestNum, outcome: "accepted", receipt_num: submission.receiptNum });
      queuedCount += batch.recipients.length;
    } catch (e) {
      const classified = classifySubmitError(e);
      outcomes.push({
        request_num: batch.requestNum,
        outcome: classified.outcome,
        error_code: classified.code,
        error_message: classified.message,
      });
    }
  }

  const mark = (await rpcData(admin, "mark_message_reservation_provider_pending", {
    p_reservation_id: params.reservationId,
    p_outcomes: outcomes,
  })) as { status?: string } | null;

  return { queuedCount, markStatus: mark?.status ?? "unknown" };
}
