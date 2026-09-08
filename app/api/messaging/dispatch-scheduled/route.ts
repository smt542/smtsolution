import { timingSafeEqual } from "node:crypto";
import { drainSchedules } from "@/lib/messaging/drainSchedules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Popbill SDK·crypto 등 Node API를 사용하므로 Node 런타임을 명시한다.
export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  let orgId: number | null = null;

  if (secret && bearer && safeEqual(bearer, secret)) {
    orgId = null;
  } else {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: contextData, error: contextError } = await supabase.rpc("get_my_context");
    if (contextError) {
      console.error("[messaging/dispatch-scheduled] get_my_context failed", contextError);
      return json({ error: "요청을 처리할 수 없습니다." }, 500);
    }
    const context = (Array.isArray(contextData) ? contextData[0] : contextData) as
      | { org_id?: number; role?: string; permissions?: unknown }
      | null;
    const permissions = Array.isArray(context?.permissions)
      ? (context.permissions as string[])
      : [];
    const hasMessaging =
      context?.role === "org_owner" ||
      context?.role === "platform_admin" ||
      permissions.includes("messaging");
    if (!context?.org_id || !hasMessaging) return json({ error: "forbidden" }, 403);

    // persona 게이트: field/support 파트너·세입자 세션 배제(기존 권한검사에 더한 방어).
    const { data: isManagerStaff } = await supabase.rpc("current_user_is_manager_staff");
    if (isManagerStaff !== true) {
      return json({ error: "권한이 없습니다." }, 403);
    }

    orgId = context.org_id;
  }

  const admin = createAdminClient();
  const result = await drainSchedules({ admin, orgId, limit: 50 });
  return json(result);
}
