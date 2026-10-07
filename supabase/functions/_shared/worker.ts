// 발송 워커 Edge Function 공통부: 크론 인증 + Vault 설정 주입 + 서비스 롤 클라이언트.
//
// 설정은 get_delivery_worker_config()(서비스 롤 전용, 0237)가 Vault에서 읽어 준다.
//  - cron_secret: pg_cron 호출의 Authorization: Bearer 값과 비교한다.
//  - popbill_env: POPBILL_* 환경변수 JSON. 앱 코드(lib/popbill/config.ts)가 읽도록 __APP_ENV__로 주입한다.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type WorkerConfig = {
  cron_secret: string | null;
  popbill_env: Record<string, string> | null;
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 인증·설정 주입에 성공하면 서비스 롤 클라이언트를, 실패하면 응답을 돌려준다. */
export async function authorizeWorker(req: Request): Promise<{ admin: SupabaseClient } | { response: Response }> {
  if (req.method !== "POST") return { response: json({ error: "method not allowed" }, 405) };

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.rpc("get_delivery_worker_config");
  if (error) return { response: json({ error: "config unavailable" }, 500) };
  const config = (data ?? {}) as WorkerConfig;

  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!config.cron_secret || !bearer || !safeEqual(bearer, config.cron_secret)) {
    return { response: json({ error: "unauthorized" }, 401) };
  }

  (globalThis as { __APP_ENV__?: Record<string, string> }).__APP_ENV__ = config.popbill_env ?? {};
  return { admin };
}
