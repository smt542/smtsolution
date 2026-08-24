import type { PopbillKakaoButton } from "popbill";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchMessages, type AlimtalkTemplateContent } from "@/lib/messaging/dispatch";
import type { SendMode, MessageRecipient } from "@/lib/messaging/preset";

// Popbill SDK·crypto 등 Node API를 사용하므로 Node 런타임을 명시한다.
export const runtime = "nodejs";

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

/** message_templates.buttons([{name,type,url}]) → Popbill 버튼({t,n,u1}) */
function toPopbillButtons(raw: unknown): PopbillKakaoButton[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
    .map((b) => ({
      t: String(b.type ?? "WL"),
      n: String(b.name ?? ""),
      u1: b.url != null ? String(b.url) : undefined,
    }));
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

  const admin = createAdminClient();

  const loadAlimtalkTemplate = async (id: number): Promise<AlimtalkTemplateContent> => {
    const { data } = await sb
      .from("message_templates")
      .select("alimtalk_template_code, buttons")
      .eq("id", id)
      .maybeSingle();
    const tpl = data as { alimtalk_template_code?: string | null; buttons?: unknown } | null;
    return {
      templateCode: tpl?.alimtalk_template_code ?? null,
      buttons: toPopbillButtons(tpl?.buttons),
    };
  };

  const result = await dispatchMessages(
    { orgId, userId, mode, body, context, templateId, recipients },
    { sb, admin, loadAlimtalkTemplate },
  );

  if (!result.ok) {
    return json(
      { error: result.code ?? "SEND_FAILED", message: result.message ?? null, ...(result.detail ?? {}) },
      result.httpStatus ?? 500,
    );
  }

  // 접수 완료 — 아직 성공/확정 차감이 아니다(202 Accepted).
  return json(
    {
      status: "queued",
      messageLogId: result.logId,
      reservationId: result.reservationId,
      queuedCount: result.queuedCount ?? 0,
      reservedPoints: result.reservedPoints ?? 0,
    },
    202,
  );
}
