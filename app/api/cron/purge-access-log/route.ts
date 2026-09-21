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
 * 접속기록 보존기간(기본 2년) 경과분을 지운다. 외부 스케줄러가 하루 한 번 호출한다.
 *
 * 보존기간은 DB 함수 purge_access_log의 기본값 한 곳에만 있다. 여기서 인수를 넘기지
 * 않는 이유이며, 기간을 바꿀 때 코드 배포 없이 마이그레이션만으로 끝난다.
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

  const { data, error } = await createAdminClient().rpc("purge_access_log");
  if (error) {
    console.error("[cron/purge-access-log] failed", error.message);
    return json({ error: "요청을 처리할 수 없습니다." }, 500);
  }

  const deleted = typeof data === "number" ? data : Number(data ?? 0);
  // 감사기록을 지운 사실 자체가 기록으로 남아야 하므로 실행 로그를 남긴다.
  console.info(`[cron/purge-access-log] deleted=${deleted}`);
  return json({ deleted });
}
