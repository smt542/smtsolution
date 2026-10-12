import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractRequestMeta, logAccess } from "@/lib/audit/accessLog";
import {
  dispatchMessages,
  toPopbillButtons,
  type AlimtalkTemplateContent,
} from "@/lib/messaging/dispatch";
import type { SendMode, MessageRecipient } from "@/lib/messaging/preset";

// Popbill SDK·crypto 등 Node API를 사용하므로 Node 런타임을 명시한다.
export const runtime = "nodejs";

/** 표준 UUID(8-4-4-4-12 hex, 대소문자 무시). DB uuid 컬럼과 멱등 replay의 기준 키다. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SendBody {
  mode: SendMode;
  body: string;
  context: string;
  templateId: number | null;
  recipients: MessageRecipient[];
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  let input: SendBody;
  try {
    input = (await request.json()) as SendBody;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { mode, body, context, templateId, recipients } = input;

  // 한 요청의 수신자 수 상한(남용 방지). 클라이언트가 지정한 대상 배열은 상류에서 별도로
  // 제한되지 않으므로, 접수/provider 액션 전에 과도한 배치를 거부한다.
  if (Array.isArray(recipients) && recipients.length > 5000) {
    return json({ error: "한 번에 최대 5000명까지 발송할 수 있습니다." }, 400);
  }

  // 멱등 키 검증(접수/예약/provider 액션 전에 수행). 한 논리적 발송 시도를 식별한다.
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return json({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key 헤더가 필요합니다." }, 400);
  }
  if (!UUID_RE.test(idempotencyKey)) {
    return json({ error: "IDEMPOTENCY_KEY_INVALID", message: "Idempotency-Key는 UUID여야 합니다." }, 400);
  }

  const sb = await createClient();
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  const { data: ctxData, error: ctxErr } = await sb.rpc("get_my_context");
  if (ctxErr) {
    console.error("[messaging/send] get_my_context failed", ctxErr);
    return json({ error: "요청을 처리할 수 없습니다." }, 500);
  }
  const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as
    | { org_id?: number; role?: string; permissions?: unknown }
    | null;
  const orgId = ctx?.org_id;
  const role = ctx?.role;
  const permissions = Array.isArray(ctx?.permissions) ? (ctx.permissions as string[]) : [];
  const hasMessaging =
    role === "org_owner" || role === "platform_admin" || permissions.includes("messaging");
  if (!orgId || !hasMessaging) return json({ error: "forbidden" }, 403);

  // persona 게이트: field/support 파트너·세입자 세션 배제(기존 권한검사에 더한 방어).
  const { data: isManagerStaff } = await sb.rpc("current_user_is_manager_staff");
  if (isManagerStaff !== true) {
    return json({ error: "권한이 없습니다." }, 403);
  }

  const admin = createAdminClient();

  const loadAlimtalkTemplate = async (id: number): Promise<AlimtalkTemplateContent> => {
    const { data } = await sb
      .from("message_templates")
      .select("alimtalk_template_code, buttons, emphasize_title")
      .eq("id", id)
      .maybeSingle();
    const tpl = data as {
      alimtalk_template_code?: string | null;
      buttons?: unknown;
      emphasize_title?: string | null;
    } | null;
    return {
      templateCode: tpl?.alimtalk_template_code ?? null,
      buttons: toPopbillButtons(tpl?.buttons),
      emphasizeTitle: tpl?.emphasize_title?.trim() || null,
    };
  };

  const result = await dispatchMessages(
    { orgId, userId, idempotencyKey, mode, body, context, templateId, recipients },
    { sb, admin, loadAlimtalkTemplate },
  );

  if (!result.ok) {
    return json(
      { error: result.code ?? "SEND_FAILED", message: result.message ?? null, ...(result.detail ?? {}) },
      result.httpStatus ?? 500,
    );
  }

  // 접수 완료 — 아직 성공/확정 차감이 아니다(202 Accepted).
  const { ip, userAgent } = extractRequestMeta(request);
  const channelCounts = result.channelCounts ?? {
    sms: mode === "alimtalk" ? 0 : result.queuedCount ?? 0,
    alimtalk: mode === "alimtalk" ? result.queuedCount ?? 0 : 0,
  };
  const auditBase = {
    persona: "manager_staff" as const,
    orgId,
    actorId: userId,
    targetKind: "message_log",
    targetId: result.logId == null ? null : String(result.logId),
    ip,
    userAgent,
  };
  if (channelCounts.sms > 0) {
    await logAccess({ ...auditBase, event: "SEND_SMS", rowCount: channelCounts.sms });
  }
  if (channelCounts.alimtalk > 0) {
    await logAccess({ ...auditBase, event: "SEND_ALIMTALK", rowCount: channelCounts.alimtalk });
  }

  return json(
    {
      status: "queued",
      messageLogId: result.logId,
      reservationId: result.reservationId,
      queuedCount: result.queuedCount ?? 0,
      reservedPoints: result.reservedPoints ?? 0,
      blockedCount: result.blockedCount ?? 0,
    },
    202,
  );
}
