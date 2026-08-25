import { timingSafeEqual } from "node:crypto";
import { reconcilePendingDeliveries } from "@/lib/messaging/reconcile";
import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * 공급자 결과 재조회 엔드포인트. 예약 발송과 동일하게 CRON_SECRET만 허용한다(내부 작업).
 * 집계만 반환하고 수신자 개인정보·공급자 원본 응답은 노출하지 않는다.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || !bearer || !safeEqual(bearer, secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createAdminClient();
  const result = await reconcilePendingDeliveries({ admin, limit: 100 });
  return json(result);
}
