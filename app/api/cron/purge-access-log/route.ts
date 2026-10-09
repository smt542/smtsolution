import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

// node:crypto를 쓰므로 Node 런타임을 명시한다(messaging/dispatch-scheduled와 동일).
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

/**
 * 개인정보 처리방침의 접속기록 보존기간(3개월=90일) 경과분을 지운다.
 *
 * 감사기록 삭제이므로 세션 폴백을 두지 않는다. CRON_SECRET만 받는다.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!secret || !bearer || !safeEqual(bearer, secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  const { data, error } = await createAdminClient().rpc("purge_access_log", {
    p_retention_days: 90,
  });
  if (error) {
    console.error("[cron/purge-access-log] failed", error.message);
    return json({ error: "요청을 처리할 수 없습니다." }, 500);
  }

  const deleted = typeof data === "number" ? data : Number(data ?? 0);
  // 감사기록을 지운 사실 자체가 기록으로 남아야 하므로 실행 로그를 남긴다.
  console.info(`[cron/purge-access-log] deleted=${deleted}`);
  return json({ deleted });
}
