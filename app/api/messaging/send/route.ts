import { randomUUID, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anyChannelConfigured, dispatchOne } from "@/lib/messaging/dispatch";
import type { AlimtalkButton } from "@/lib/messaging/alimtalk";
import type { SendMode, MessageChannel, MessageRecipient } from "@/lib/messaging/preset";

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

  const sb = await createClient();
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  const { data: ctxData, error: ctxErr } = await sb.rpc("get_my_context");
  if (ctxErr) return json({ error: ctxErr.message }, 500);
  const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as
    | { org_id?: number; role?: string; permissions?: unknown }
    | null;
  const orgId = ctx?.org_id;
  const role = ctx?.role;
  const permissions = Array.isArray(ctx?.permissions) ? (ctx.permissions as string[]) : [];
  const hasMessaging =
    role === "org_owner" || role === "platform_admin" || permissions.includes("messaging");
  if (!orgId || !hasMessaging) return json({ error: "forbidden" }, 403);

  // D2: 채널이 하나도 설정 안 됐으면 기존 stub 경로 유지(포인트 무관·result='stub'=미발송)
  if (!anyChannelConfigured(mode)) {
    const { data, error } = await sb.rpc("send_messages", {
      p_channel: mode,
      p_body: body,
      p_context: context,
      p_recipients: recipients,
      p_template_id: templateId,
    });
    if (error) return json({ error: error.message }, 500);
    const stub = data as { log_id: number; count: number };
    return json({ billingMode: "stub", messageLogId: stub.log_id, result: "stub", chargedPoints: 0, recipients: [] });
  }

  // 실경로 — 견적
  const { data: quoteData, error: qErr } = await sb.rpc("quote_message_points", {
    p_mode: mode,
    p_recipients: recipients,
    p_template_id: templateId,
  });
  if (qErr) return json({ error: qErr.message }, 500);
  const quote = quoteData as {
    ok?: boolean;
    code?: string;
    message?: string;
    resolved_recipients?: { phone: string; channel: MessageChannel }[];
    recipient_costs?: { recipient_key: string; channel: MessageChannel }[];
    rate_ids?: unknown;
    estimated_points?: number;
  } | null;
  if (!quote?.ok) return json({ error: quote?.code ?? "QUOTE_FAILED", message: quote?.message ?? null }, 400);
  const resolved = quote.resolved_recipients ?? [];
  const costs = quote.recipient_costs ?? [];

  // 알림톡 수신자가 있으면 템플릿의 알림톡 코드·버튼 로드
  let alimtalkTemplateCode: string | null = null;
  let alimtalkButtons: AlimtalkButton[] = [];
  if (templateId && resolved.some((r) => r.channel === "alimtalk")) {
    const { data: tpl } = await sb
      .from("message_templates")
      .select("alimtalk_template_code, buttons")
      .eq("id", templateId)
      .maybeSingle();
    const t = tpl as { alimtalk_template_code?: string | null; buttons?: unknown } | null;
    alimtalkTemplateCode = t?.alimtalk_template_code ?? null;
    alimtalkButtons = Array.isArray(t?.buttons) ? (t.buttons as AlimtalkButton[]) : [];
  }

  // 예약(하드스톱) — service role
  const admin = createAdminClient();
  const payloadHash = createHash("sha256")
    .update(`${mode}|${body}|${JSON.stringify(recipients)}`)
    .digest("hex")
    .slice(0, 128);
  const { data: resData, error: rErr } = await admin.rpc("reserve_message_points", {
    p_org_id: orgId,
    p_requested_by: userId,
    p_idempotency_key: randomUUID(),
    p_payload_hash: payloadHash,
    p_mode: mode,
    p_body: body,
    p_context: context,
    p_recipients: recipients,
    p_template_id: templateId,
    p_confirmed_rate_ids: quote.rate_ids,
    p_confirmed_points: quote.estimated_points,
  });
  if (rErr) return json({ error: rErr.message }, 500);
  const reserve = resData as {
    ok?: boolean;
    code?: string;
    reservation_id?: number;
    message_log_id?: number;
    required_points?: number;
    available_points?: number;
  } | null;
  if (!reserve?.ok) {
    const status = reserve?.code === "INSUFFICIENT_POINTS" ? 402 : 409;
    return json({ error: reserve?.code ?? "RESERVE_FAILED", ...reserve }, status);
  }
  const reservationId = reserve.reservation_id as number;
  const messageLogId = reserve.message_log_id as number;

  // 수신자별 발송 (resolved[i] ↔ costs[i] 인덱스 zip → recipient_key)
  const results: { recipient_key: string; status: "success" | "failed"; reason?: string }[] = [];
  let providerRequestId: string | null = null;
  for (let i = 0; i < resolved.length; i++) {
    const key = costs[i]?.recipient_key;
    if (!key) continue;
    const channel = resolved[i].channel;
    const d = await dispatchOne({
      channel,
      phone: resolved[i].phone,
      body,
      templateCode: channel === "alimtalk" ? alimtalkTemplateCode : null,
      buttons: channel === "alimtalk" ? alimtalkButtons : undefined,
    });
    if (d.providerId && !providerRequestId) providerRequestId = d.providerId;
    results.push({ recipient_key: key, status: d.status, reason: d.reason });
  }

  // 정산
  const { data: setData, error: sErr } = await admin.rpc("settle_message_points", {
    p_reservation_id: reservationId,
    p_provider_request_id: providerRequestId,
    p_results: results.map(({ recipient_key, status }) => ({ recipient_key, status })),
  });
  if (sErr) return json({ error: sErr.message }, 500);
  const settle = setData as { status?: string; result?: string; charged_points?: number } | null;

  return json({
    billingMode: "live",
    messageLogId,
    reservationId,
    result: settle?.result ?? settle?.status ?? "unknown",
    chargedPoints: settle?.charged_points ?? 0,
    recipients: results.map((r) => ({ status: r.status, reason: r.reason ?? null })),
  });
}
