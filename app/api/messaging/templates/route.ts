import { isPopbillConfigured } from "@/lib/popbill/config";
import {
  getChannelConsoleUrl,
  getTemplateConsoleUrl,
  listAlimtalkTemplates,
} from "@/lib/popbill/templates";
import { createClient } from "@/lib/supabase/server";

// 팝빌 SDK(Node API)를 사용하므로 Node 런타임을 명시한다.
export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** messaging 권한 + org 확인. 통과하면 세션 클라이언트를 반환한다. */
async function guard(): Promise<
  { denied: Response } | { supabase: SupabaseServerClient }
> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { denied: json({ error: "unauthorized" }, 401) };

  const { data: ctx, error } = await supabase.rpc("get_my_context");
  if (error) return { denied: json({ error: "요청을 처리할 수 없습니다." }, 500) };
  const context = (Array.isArray(ctx) ? ctx[0] : ctx) as
    | { org_id?: number; role?: string; permissions?: unknown }
    | null;
  const permissions = Array.isArray(context?.permissions)
    ? (context.permissions as string[])
    : [];
  const hasMessaging =
    context?.role === "org_owner" ||
    context?.role === "platform_admin" ||
    permissions.includes("messaging");
  if (!context?.org_id || !hasMessaging) return { denied: json({ error: "forbidden" }, 403) };

  return { supabase };
}

/** 팝빌 콘솔 딥링크(일회성 URL) 조회 — 템플릿 관리 · 카카오 채널. */
export async function GET(): Promise<Response> {
  const g = await guard();
  if ("denied" in g) return g.denied;
  if (!isPopbillConfigured()) return json({ error: "PROVIDER_NOT_CONFIGURED" }, 503);
  try {
    const [templateUrl, channelUrl] = await Promise.all([
      getTemplateConsoleUrl(),
      getChannelConsoleUrl(),
    ]);
    return json({ templateUrl, channelUrl });
  } catch {
    return json({ error: "PROVIDER_ERROR" }, 502);
  }
}

/** 팝빌 승인 알림톡 템플릿을 우리 DB로 동기화. */
export async function POST(): Promise<Response> {
  const g = await guard();
  if ("denied" in g) return g.denied;
  if (!isPopbillConfigured()) return json({ error: "PROVIDER_NOT_CONFIGURED" }, 503);

  let approved;
  try {
    const templates = await listAlimtalkTemplates();
    approved = templates.filter((t) => t.approved);
  } catch {
    return json({ error: "PROVIDER_ERROR" }, 502);
  }

  const { data, error } = await g.supabase.rpc("sync_alimtalk_templates", {
    p_templates: approved,
  });
  if (error) return json({ error: error.message }, 400);
  return json({ synced: (data as number) ?? 0, approved: approved.length });
}
