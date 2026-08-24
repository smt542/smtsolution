import { randomUUID, createHash } from "node:crypto";
import type { PopbillKakaoButton } from "popbill";
import { type SendMode, type MessageChannel, type MessageRecipient } from "./preset";
import { isNcpConfigured, sendSmsViaNcp } from "./ncp";
import { isAlimtalkConfigured, sendAlimtalkViaNcp, type AlimtalkButton } from "./alimtalk";
import { isPopbillConfigured, PopbillNotConfiguredError } from "@/lib/popbill/config";
import { submitMessageBatch } from "@/lib/popbill/messages";
import {
  PopbillSubmitError,
  type MessageBatchInput,
  type MessageContent,
  type ProviderSubmission,
} from "@/lib/popbill/types";
import { buildSubmissionPlan, type PlanProduct, type PlanRecipient } from "./submission";

export interface DispatchResult {
  status: "success" | "failed";
  reason?: string;
  providerId?: string;
}

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

  // 3) 제품별 배치 계획
  const planRecipients: PlanRecipient[] = [];
  for (let i = 0; i < costs.length; i += 1) {
    const cost = costs[i];
    const person = resolved[i] ?? {};
    planRecipients.push({
      recipientKey: String(cost.recipient_key ?? ""),
      phone: normalizePhone(person.phone),
      name: (person.name as string | null) ?? null,
      product: (cost.product as PlanProduct) ?? "sms",
    });
  }
  const plan = buildSubmissionPlan({ scope: "m", id: reservationId, recipients: planRecipients });

  // 4) 알림톡 콘텐츠(템플릿/버튼) 로드
  let alimtalk: AlimtalkTemplateContent = { templateCode: null, buttons: [] };
  if (plan.some((b) => b.product === "alimtalk") && input.templateId != null && deps.loadAlimtalkTemplate) {
    alimtalk = await deps.loadAlimtalkTemplate(input.templateId);
  }

  // 5) submitting 작업 저장
  await rpcData(deps.admin, "create_provider_dispatch_jobs", {
    p_reservation_id: reservationId,
    p_jobs: plan.map((b) => ({
      product: b.product,
      request_num: b.requestNum,
      recipients: b.recipients.map((r) => ({
        recipient_key: r.recipientKey,
        provider_ref_key: r.providerRefKey,
      })),
    })),
  });

  // 6) 배치별 Popbill 접수
  const outcomes: Array<Record<string, unknown>> = [];
  let queuedCount = 0;
  for (const batch of plan) {
    const content: MessageContent =
      batch.product === "alimtalk"
        ? { body: input.body, templateCode: alimtalk.templateCode, buttons: alimtalk.buttons }
        : { body: input.body };
    try {
      const submission = await submitBatch(
        { product: batch.product, requestNum: batch.requestNum, recipients: batch.recipients },
        content,
      );
      outcomes.push({
        request_num: batch.requestNum,
        outcome: "accepted",
        receipt_num: submission.receiptNum,
      });
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

  // 7) 접수 결과 반영 → provider_pending / reconcile_required / released
  await rpcData(deps.admin, "mark_message_reservation_provider_pending", {
    p_reservation_id: reservationId,
    p_outcomes: outcomes,
  });

  return {
    ok: true,
    status: "queued",
    logId: messageLogId,
    reservationId,
    queuedCount,
    reservedPoints,
  };
}

/** 실경로 진입 판단: 요청 채널(mode)에 해당하는 어댑터가 하나라도 설정됐는가. */
export function anyChannelConfigured(mode: SendMode): boolean {
  if (mode === "sms") return isNcpConfigured();
  if (mode === "alimtalk") return isAlimtalkConfigured();
  return isNcpConfigured() || isAlimtalkConfigured(); // auto
}

/** 수신자 1건을 해석된 채널로 실발송. 미설정 채널은 failed(unconfigured)로 스킵(실호출 없음). */
export async function dispatchOne(input: {
  channel: MessageChannel;
  phone: string;
  body: string;
  templateCode?: string | null;
  buttons?: AlimtalkButton[];
}): Promise<DispatchResult> {
  try {
    if (input.channel === "sms") {
      if (!isNcpConfigured()) return { status: "failed", reason: "unconfigured" };
      const r = await sendSmsViaNcp({ to: input.phone, content: input.body });
      return r.ok
        ? { status: "success", providerId: r.requestId ?? undefined }
        : { status: "failed", reason: `sms_${r.statusCode ?? "error"}` };
    }
    // alimtalk
    if (!isAlimtalkConfigured()) return { status: "failed", reason: "unconfigured" };
    if (!input.templateCode) return { status: "failed", reason: "no_template_code" };
    const r = await sendAlimtalkViaNcp({
      to: input.phone,
      templateCode: input.templateCode,
      content: input.body,
      buttons: input.buttons,
    });
    return r.ok
      ? { status: "success", providerId: r.requestId ?? undefined }
      : { status: "failed", reason: `alimtalk_${r.statusCode ?? "error"}` };
  } catch (e) {
    return { status: "failed", reason: e instanceof Error ? e.message : String(e) };
  }
}
