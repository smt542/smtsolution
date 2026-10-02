import { createHash, randomUUID } from "node:crypto";
import type { PopbillKakaoButton } from "popbill";
import { type SendMode, type MessageRecipient } from "./preset";
import {
  isPopbillConfigured,
  PopbillNotConfiguredError,
  readPopbillConfig,
  type PopbillConfig,
} from "@/lib/popbill/config";
import { isLiveRecipientAllowed, RECIPIENT_NOT_ALLOWED } from "@/lib/popbill/allowlist";
import { submitMessageBatch } from "@/lib/popbill/messages";
import {
  PopbillSubmitError,
  PopbillTimeoutError,
  type MessageBatchInput,
  type MessageContent,
  type ProviderSubmission,
} from "@/lib/popbill/types";
import {
  computeNextPollAt,
  defaultFetchResultsByRequestNum,
  type ProviderRecipientResult,
} from "@/lib/popbill/results";
import { buildSubmissionPlan, type PlanProduct, type PlanRecipient } from "./submission";
import { canonicalSendPayload } from "./sendSignature";
import { renderTemplate } from "./render";

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
  /**
   * 한 논리적 발송 시도의 멱등 키(UUID). 라우트에서 검증한 Idempotency-Key 헤더를 그대로 전달한다.
   * 동일 키의 재시도/중복 클릭은 reserve_message_points에서 기존 예약을 replay로 반환하고 재접수하지 않는다.
   */
  idempotencyKey: string;
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
  submitBatch?: (
    batch: MessageBatchInput,
    content: MessageContent,
    config?: PopbillConfig,
  ) => Promise<ProviderSubmission>;
  isConfigured?: () => boolean;
  config?: PopbillConfig;
  loadOrgSmsSender?: (orgId: number) => Promise<string | null>;
  /** 접수 재시도 대기(L6). 테스트 주입용. 기본은 실지연. */
  sleep?: (ms: number) => Promise<void>;
}

interface SetupConfigQueryClient {
  from(table: "setup_config"): {
    select(columns: "sms_sender"): {
      eq(column: "org_id", value: number): {
        maybeSingle(): PromiseLike<{
          data: { sms_sender?: string | null } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export async function loadOrgSmsSender(client: SupabaseClientLike, orgId: number): Promise<string | null> {
  const { data, error } = await (client as SupabaseClientLike & SetupConfigQueryClient)
    .from("setup_config")
    .select("sms_sender")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.sms_sender ?? null;
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
  /** 운영 허용 목록 밖이라 팝빌로 보내지 않은 수신자 수. */
  blockedCount?: number;
  reservedPoints?: number;
  channelCounts?: DispatchChannelCounts;
}

export interface DispatchChannelCounts {
  sms: number;
  alimtalk: number;
}

function emptyChannelCounts(): DispatchChannelCounts {
  return { sms: 0, alimtalk: 0 };
}

function countChannelProducts(costs: Array<Record<string, unknown>>): DispatchChannelCounts {
  const counts = emptyChannelCounts();
  for (const cost of costs) {
    if (cost.product === "alimtalk") counts.alimtalk += 1;
    else if (cost.product === "sms" || cost.product === "lms") counts.sms += 1;
  }
  return counts;
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
  status?: string;
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
  // 확정 거절(failed): 설정 누락, 로컬 검증(템플릿/변수), Popbill SDK 오류 콜백. 접수가 거부된 것이
  // 확정이므로 예약 금액을 반환한다. 오직 전송/무응답 타임아웃만 접수 여부가 불분명한 unknown이며
  // reconcile_required로 남겨 즉시 재발송하지 않는다.
  if (e instanceof PopbillNotConfiguredError) {
    return { outcome: "failed", code: e.code, message: "발신 설정이 없습니다." };
  }
  if (e instanceof PopbillTimeoutError) {
    return { outcome: "unknown", code: e.code, message: e.message };
  }
  if (e instanceof PopbillSubmitError) {
    return { outcome: "failed", code: e.code, message: e.message };
  }
  // 예기치 못한 예외는 접수 여부가 불분명하므로 보수적으로 unknown(reconcile_required)으로 남긴다.
  return { outcome: "unknown", code: "SUBMIT_ERROR", message: "발송 접수 중 오류가 발생했습니다." };
}

/** 전부 거절된 발송의 대표 사유. 화면 안내가 있는 코드만 돌려주고, 그 밖은 null(SEND_REJECTED). */
export function rejectReasonFromCodes(codes: string[]): string | null {
  if (codes.length > 0 && codes.every((code) => code === RECIPIENT_NOT_ALLOWED)) {
    return RECIPIENT_NOT_ALLOWED;
  }
  return null;
}

// === L6: 공급자 '구조화된 거절'에 한해 제한적 재시도(백오프) ===
// 안전 원칙(이중발송 방지): 접수번호(receipt)가 발급되지 않은 '확정 거절'만 재시도한다.
// 공급자가 요청을 받아 코드로 반려한 경우는 접수가 성립하지 않았으므로, 동일 requestNum 재접수가
// 이중발송을 만들지 않는다. 반대로 타임아웃(PopbillTimeoutError)·예기치못한 예외·코드 없는 오류는
// 접수 여부가 불명확(전송 후 응답 유실/네트워크 등)하므로 재시도하지 않고 unknown(reconcile)로 남긴다.
// 로컬 검증 실패(템플릿/변수/발신번호)·설정 누락은 동일 입력에 영구 실패이므로 재시도하지 않는다.
const NON_RETRYABLE_SUBMIT_CODES = new Set<string>([
  "NO_TEMPLATE_CODE",
  "UNRESOLVED_VARIABLES",
  "SENDER_NOT_REGISTERED",
  // 코드 없는 SDK/전송 오류. 접수 여부가 불명확하므로(이중발송 위험) 재시도하지 않는다.
  "PROVIDER_ERROR",
  // 운영 허용 목록 밖(팝빌을 부르지 않은 확정 실패).
  RECIPIENT_NOT_ALLOWED,
]);

export function isRetryableSubmitError(e: unknown): boolean {
  // PopbillSubmitError(구조화된 공급자 거절)만 재시도 후보. 타임아웃·예기치못한 예외·설정누락은 제외.
  if (!(e instanceof PopbillSubmitError)) return false;
  return !NON_RETRYABLE_SUBMIT_CODES.has(e.code);
}

const SUBMIT_MAX_RETRIES = 2;
const SUBMIT_RETRY_BASE_MS = 500;

/** 지수 백오프 지연(ms): 첫 재시도 500ms, 두 번째 1000ms. 총합이 접수 lease(5분)를 넘지 않는다. */
export function submitRetryDelayMs(attempt: number): number {
  return SUBMIT_RETRY_BASE_MS * 2 ** attempt;
}

const defaultSubmitSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 접수 1건을 제한적으로 재시도한다. 재시도 대상은 '구조화된 공급자 거절'(isRetryableSubmitError)뿐이며,
 * 재시도를 소진하면 마지막 오류를 그대로 던져 기존 classifySubmitError 경로(failed/unknown)로 넘긴다.
 * sleep은 테스트에서 주입 가능(기본은 setTimeout 기반 실지연).
 */
export async function submitBatchWithRetry(
  submitBatch: (
    batch: MessageBatchInput,
    content: MessageContent,
    config?: PopbillConfig,
  ) => Promise<ProviderSubmission>,
  batch: MessageBatchInput,
  content: MessageContent,
  config: PopbillConfig | undefined,
  sleep: (ms: number) => Promise<void> = defaultSubmitSleep,
): Promise<ProviderSubmission> {
  let attempt = 0;
  for (;;) {
    try {
      return await submitBatch(batch, content, config);
    } catch (e) {
      if (attempt >= SUBMIT_MAX_RETRIES || !isRetryableSubmitError(e)) throw e;
      await sleep(submitRetryDelayMs(attempt));
      attempt += 1;
    }
  }
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

  const envConfig = deps.config ?? readPopbillConfig();
  const orgSmsSender = await (deps.loadOrgSmsSender ?? ((orgId) => loadOrgSmsSender(deps.admin, orgId)))(
    input.orgId,
  );
  const effectiveConfig: PopbillConfig = {
    ...envConfig,
    // org 발신번호는 숫자만 넘긴다. 쓰기 경로(/api/setup/sender)가 이미 정규화하지만,
    // 이 값은 실제 발송에 그대로 실려 나가므로 읽는 쪽에서도 보장한다.
    // (이 파일에 이미 있는 로컬 normalizePhone — 숫자만 남긴다)
    smsSender: normalizePhone(orgSmsSender) || envConfig.smsSender,
  };

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

  // 2) 예약(service_role) — 접수 전 하드스톱. 멱등 키는 라우트에서 검증한 값을 그대로 쓴다.
  const reserve = (await rpcData(deps.admin, "reserve_message_points", {
    p_org_id: input.orgId,
    p_requested_by: input.userId,
    p_idempotency_key: input.idempotencyKey,
    // 페이로드 해시는 모든 material 발송 필드(mode·body·context·effective templateId·완전한 수신자)를
    // 덮는다. 수신자 identity/ref가 바뀌면 해시도 달라져, 같은 키로 stale 예약을 재사용하지 못한다.
    p_payload_hash: createHash("sha256")
      .update(
        canonicalSendPayload({
          mode: input.mode,
          body: input.body,
          context: input.context,
          templateId: input.templateId,
          recipients: input.recipients,
        }),
      )
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

  // 멱등 replay: 기존 예약이 있으면 절대 재접수/재마킹/재작업생성하지 않는다. 저장된 예약 상태로만
  // 응답하며 어떤 경로도 provider를 다시 호출하지 않는다(중복 클릭·재시도·동시 호출의 이중 발송 방지).
  if (reserve.replayed) {
    const replayedChannelCounts = countChannelProducts(
      reserve.recipient_costs ?? quote.recipient_costs ?? [],
    );
    switch (reserve.status) {
      case "released":
        // 이전 시도가 전부 확정 거절되어 예약이 반환됨 → 재발송 없이 동일한 안전 실패.
        return {
          ok: false,
          code: "SEND_REJECTED",
          message: "발송이 확정 거절되었습니다.",
          httpStatus: 502,
          reservationId,
        };
      case "provider_pending":
      case "settled":
        // 접수 receipt가 있거나(provider_pending) 이미 최종 정산됨(settled) → 안전하게 queued(접수 상태)로 응답.
        return {
          ok: true,
          status: "queued",
          logId: messageLogId,
          reservationId,
          reservedPoints,
          channelCounts: replayedChannelCounts,
        };
      case "reconcile_required":
        // 접수 결과가 불명확 → 아직 성공 접수(queued)로 표기하지 않는다. 재조회/수동 확인 대상.
        return {
          ok: false,
          code: "SEND_UNCONFIRMED",
          message: "발송 접수 결과를 확인하지 못했습니다. 결과 확인 후 처리됩니다.",
          httpStatus: 502,
          reservationId,
        };
      case "reserved":
      default:
        // 예약만 있고 접수(mark)가 아직 안 됨(동시 요청이 접수 중이거나 이전 시도가 중단됨). 절대
        // 재접수하지 않고 queued로도 표기하지 않는다. 진행 중임을 알리는 비성공 응답(409)으로 남긴다.
        return {
          ok: false,
          code: "SEND_IN_PROGRESS",
          message: "동일 요청이 처리 중입니다. 잠시 후 결과를 확인해 주세요.",
          httpStatus: 409,
          reservationId,
        };
    }
  }

  const resolved = reserve.resolved_recipients ?? quote.resolved_recipients ?? [];
  const costs = reserve.recipient_costs ?? quote.recipient_costs ?? [];

  // 3~7) 배치 계획 → submitting 저장 → Popbill 접수 → provider_pending (예약/스케줄 공용)
  const { queuedCount, markStatus, channelCounts, blockedCount, failureCodes } = await submitReservationBatches(
    deps.admin,
    {
      orgId: input.orgId,
      reservationId,
      scheduleId: null,
      body: input.body,
      templateId: input.templateId,
      resolved,
      costs,
    },
    { submitBatch, loadAlimtalkTemplate: deps.loadAlimtalkTemplate, config: effectiveConfig, sleep: deps.sleep },
  );

  // 접수 receipt가 하나라도 있는 경우(provider_pending)에만 queued로 보고한다.
  if (markStatus === "provider_pending") {
    return {
      ok: true,
      status: "queued",
      logId: messageLogId,
      reservationId,
      queuedCount,
      blockedCount,
      reservedPoints,
      channelCounts,
    };
  }
  // 전부 확정 거절(released) → 예약은 이미 반환됨. queued로 표기하지 않고 명확한 실패를 반환한다.
  if (markStatus === "released") {
    return {
      ok: false,
      code: rejectReasonFromCodes(failureCodes) ?? "SEND_REJECTED",
      message: "모든 발송이 확정 거절되었습니다.",
      httpStatus: 502,
      reservationId,
    };
  }
  // 접수 receipt 없이 불명확(reconcile_required) → queued로 표기하지 않는다. 예약 금액은 유지되고
  // 재조회/수동 확인 대상으로 남는다(즉시 재발송하지 않음).
  if (markStatus === "reconcile_required") {
    return {
      ok: false,
      code: "SEND_UNCONFIRMED",
      message: "발송 접수 결과를 확인하지 못했습니다. 결과 확인 후 처리됩니다.",
      httpStatus: 502,
      reservationId,
    };
  }
  // 알 수 없는 mark 상태: receipt가 있으면 queued, 없으면 보수적으로 실패로 응답한다.
  if (queuedCount > 0) {
    return {
      ok: true,
      status: "queued",
      logId: messageLogId,
      reservationId,
      queuedCount,
      reservedPoints,
      channelCounts,
    };
  }
  return { ok: false, code: "SEND_FAILED", message: "발송을 접수하지 못했습니다.", httpStatus: 502, reservationId };
}

/** message_templates.buttons([{name,type,url}]) → Popbill 버튼({t,n,u1,u2}) */
export function toPopbillButtons(raw: unknown): PopbillKakaoButton[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
    .map((b) => ({
      t: String(b.type ?? b.t ?? "WL"),
      n: String(b.name ?? b.n ?? ""),
      u1: b.url != null ? String(b.url) : b.u1 != null ? String(b.u1) : undefined,
      u2: b.u2 != null ? String(b.u2) : undefined,
    }));
}

function recipientVariables(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function renderAlimtalkButtons(
  buttons: PopbillKakaoButton[],
  variables: Record<string, string>,
): PopbillKakaoButton[] {
  return buttons.map((button) => ({
    ...button,
    u1: typeof button.u1 === "string" ? renderTemplate(button.u1, variables) : button.u1,
    u2: typeof button.u2 === "string" ? renderTemplate(button.u2, variables) : button.u2,
  }));
}

export interface SubmitReservationParams {
  /** 발송 조직. 운영 모드 허용 번호 판정(데모 조직 제한)에 쓴다. */
  orgId: number;
  reservationId: number;
  scheduleId?: number | null;
  body: string;
  templateId: number | null;
  resolved: Array<Record<string, unknown>>;
  costs: Array<Record<string, unknown>>;
}
export interface SubmitReservationDeps {
  submitBatch?: (
    batch: MessageBatchInput,
    content: MessageContent,
    config?: PopbillConfig,
  ) => Promise<ProviderSubmission>;
  loadAlimtalkTemplate?: (templateId: number) => Promise<AlimtalkTemplateContent>;
  reconcileBatch?: (batch: {
    product: PlanProduct;
    requestNum: string;
  }) => Promise<ProviderRecipientResult[]>;
  config?: PopbillConfig;
  /** 접수 재시도 대기(L6). 테스트 주입용. 기본은 실지연. */
  sleep?: (ms: number) => Promise<void>;
}
interface CreatedJobRow {
  job_id?: number;
  request_num: string;
  status?: string;
  receipt_num?: string | null;
  claimed_at?: string | null;
}
interface SubmissionClaim {
  ok?: boolean;
  action?: "submit" | "reconcile" | "wait" | "terminal";
  job_id?: number;
  status?: string;
  receipt_num?: string | null;
  claimed_at?: string | null;
}

/**
 * 예약(reservationId)의 수신자를 제품별 배치로 접수한다. 즉시/예약 발송 공용.
 * 재claim/replay 안전: 이미 receipt를 받은 배치는 재발송하지 않고 접수 상태를 유지한다.
 */
export async function submitReservationBatches(
  admin: SupabaseClientLike,
  params: SubmitReservationParams,
  deps: SubmitReservationDeps,
): Promise<{
  queuedCount: number;
  markStatus: string;
  channelCounts: DispatchChannelCounts;
  blockedCount: number;
  failureCodes: string[];
}> {
  const submitBatch = deps.submitBatch ?? submitMessageBatch;
  const reconcileBatch =
    deps.reconcileBatch ??
    ((batch: { product: PlanProduct; requestNum: string }) =>
      defaultFetchResultsByRequestNum(batch, deps.config));

  let alimtalk: AlimtalkTemplateContent = { templateCode: null, buttons: [] };
  if (
    params.costs.some((cost) => cost.product === "alimtalk") &&
    params.templateId != null &&
    deps.loadAlimtalkTemplate
  ) {
    alimtalk = await deps.loadAlimtalkTemplate(params.templateId);
  }

  const resolvedByRecipientKey = new Map<string, Record<string, unknown>>();
  for (const person of params.resolved) {
    const phone = normalizePhone(person.phone);
    const recipientKey = phone ? createHash("sha256").update(phone).digest("hex") : "";
    if (!recipientKey || resolvedByRecipientKey.has(recipientKey)) {
      throw new Error("resolved recipient identity is missing or duplicated");
    }
    resolvedByRecipientKey.set(recipientKey, person);
  }

  const planRecipients: PlanRecipient[] = [];
  for (const cost of params.costs) {
    const recipientKey = String(cost.recipient_key ?? "");
    const person = resolvedByRecipientKey.get(recipientKey);
    if (!recipientKey || !person) {
      throw new Error("recipient cost does not match a resolved recipient");
    }
    // 수신자별 최종 렌더 본문을 보존한다. 없으면 배치 공통 본문으로 대체된다(접수 시점 대체).
    const rendered = person.renderedBody;
    const product = (cost.product as PlanProduct) ?? "sms";
    const renderedButtons =
      product === "alimtalk" && alimtalk.buttons.length > 0
        ? renderAlimtalkButtons(alimtalk.buttons, recipientVariables(person.variables))
        : undefined;
    planRecipients.push({
      recipientKey,
      phone: normalizePhone(person.phone),
      name: (person.name as string | null) ?? null,
      product,
      renderedBody: typeof rendered === "string" && rendered.length > 0 ? rendered : null,
      buttons: renderedButtons,
    });
  }
  // 운영 모드 허용 번호 목록(spec 4.1): 목록 밖 수신자는 별도 작업(scope "mx")으로 만들고 팝빌로 넘기지 않는다.
  // 같은 입력의 재시도는 같은 분할·같은 requestNum을 만든다(결정적).
  const providerConfig = deps.config ?? readPopbillConfig();
  const isAllowed = (recipient: PlanRecipient) =>
    isLiveRecipientAllowed(params.orgId, recipient.phone, providerConfig);
  const allowedPlan = buildSubmissionPlan({
    scope: "m",
    id: params.reservationId,
    recipients: planRecipients.filter(isAllowed),
  });
  const blockedPlan = buildSubmissionPlan({
    scope: "mx",
    id: params.reservationId,
    recipients: planRecipients.filter((recipient) => !isAllowed(recipient)),
  });
  const blockedRequestNums = new Set(blockedPlan.map((batch) => batch.requestNum));
  const plan = [...allowedPlan, ...blockedPlan];

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
  let blockedCount = 0;
  const failureCodes: string[] = [];
  const channelCounts = emptyChannelCounts();
  const submitOwner = randomUUID();
  for (const batch of plan) {
    const info = jobByReq.get(batch.requestNum);
    // 이미 접수번호가 있으면 재발송하지 않고 접수 상태를 유지한다(중복 발송 방지).
    if (info?.receipt_num) {
      outcomes.push({
        request_num: batch.requestNum,
        outcome: "accepted",
        receipt_num: info.receipt_num,
        submit_owner: submitOwner,
      });
      queuedCount += batch.recipients.length;
      channelCounts[batch.product === "alimtalk" ? "alimtalk" : "sms"] += batch.recipients.length;
      continue;
    }

    const claim = (await rpcData(admin, "claim_provider_dispatch_submission", {
      p_reservation_id: params.reservationId,
      p_request_num: batch.requestNum,
      p_owner: submitOwner,
    })) as SubmissionClaim | null;

    if (claim?.receipt_num) {
      outcomes.push({
        request_num: batch.requestNum,
        outcome: "accepted",
        receipt_num: claim.receipt_num,
        submit_owner: submitOwner,
      });
      queuedCount += batch.recipients.length;
      channelCounts[batch.product === "alimtalk" ? "alimtalk" : "sms"] += batch.recipients.length;
      continue;
    }

    if (claim?.action === "reconcile") {
      let results: ProviderRecipientResult[] = [];
      try {
        results = await reconcileBatch({ product: batch.product, requestNum: batch.requestNum });
      } catch {
        results = [];
      }
      const claimedAt = new Date(claim.claimed_at ?? info?.claimed_at ?? Date.now());
      const nextPollAt = computeNextPollAt(claimedAt, new Date());
      await rpcData(admin, "apply_provider_dispatch_results", {
        p_job_id: claim.job_id ?? info?.job_id,
        p_results: results
          .filter((result) => result.status !== "pending")
          .map((result) => ({
            provider_ref_key: result.providerRefKey,
            status: result.status,
            code: result.code,
          })),
        p_next_poll_at: nextPollAt?.toISOString() ?? null,
      });
      if (results.length > 0) {
        queuedCount += batch.recipients.length;
        channelCounts[batch.product === "alimtalk" ? "alimtalk" : "sms"] += batch.recipients.length;
      }
      continue;
    }

    // Only the owner returned by the atomic DB claim may cross the provider boundary.
    if (claim?.ok !== true || claim.action !== "submit") continue;

    if (blockedRequestNums.has(batch.requestNum)) {
      // 허용 목록 밖: 팝빌을 부르지 않고 확정 실패로 기록한다. 수신자 실패·미차감은 기존 정산 경로가 처리한다.
      outcomes.push({
        request_num: batch.requestNum,
        outcome: "failed",
        error_code: RECIPIENT_NOT_ALLOWED,
        error_message: "운영 발송 허용 목록에 없는 번호입니다.",
        submit_owner: submitOwner,
      });
      blockedCount += batch.recipients.length;
      failureCodes.push(RECIPIENT_NOT_ALLOWED);
      continue;
    }

    const content: MessageContent =
      batch.product === "alimtalk"
        ? { body: params.body, templateCode: alimtalk.templateCode, buttons: alimtalk.buttons }
        : { body: params.body };
    try {
      const submission = await submitBatchWithRetry(
        submitBatch,
        {
          orgId: params.orgId,
          product: batch.product,
          requestNum: batch.requestNum,
          recipients: batch.recipients,
        },
        content,
        deps.config,
        deps.sleep,
      );
      outcomes.push({
        request_num: batch.requestNum,
        outcome: "accepted",
        receipt_num: submission.receiptNum,
        submit_owner: submitOwner,
      });
      queuedCount += batch.recipients.length;
      channelCounts[batch.product === "alimtalk" ? "alimtalk" : "sms"] += batch.recipients.length;
    } catch (e) {
      const classified = classifySubmitError(e);
      if (classified.outcome === "failed") failureCodes.push(classified.code);
      outcomes.push({
        request_num: batch.requestNum,
        outcome: classified.outcome,
        error_code: classified.code,
        error_message: classified.message,
        submit_owner: submitOwner,
      });
    }
  }

  const mark = (await rpcData(admin, "mark_message_reservation_provider_pending", {
    p_reservation_id: params.reservationId,
    p_outcomes: outcomes,
  })) as { status?: string } | null;

  return { queuedCount, markStatus: mark?.status ?? "unknown", channelCounts, blockedCount, failureCodes };
}
